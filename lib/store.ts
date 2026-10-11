import { Redis } from "@upstash/redis";
import { ENDPOINT_TTL_SECONDS, MAX_REQUESTS } from "./config";
import type { CapturedRequest, Endpoint, ResponseConfig } from "./types";

/**
 * Storage abstraction. Uses Upstash Redis when configured (Vercel Marketplace
 * injects KV_REST_API_URL/KV_REST_API_TOKEN; plain Upstash uses
 * UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN). Falls back to an
 * in-memory store for local development.
 */
export interface Store {
  createEndpoint(id: string): Promise<Endpoint>;
  getEndpoint(id: string): Promise<Endpoint | null>;
  setResponse(id: string, response: ResponseConfig | null): Promise<void>;
  addRequest(id: string, req: CapturedRequest): Promise<void>;
  listRequests(id: string): Promise<CapturedRequest[]>;
  deleteEndpoint(id: string): Promise<void>;
}

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const epKey = (id: string) => `wi:ep:${id}`;
const reqKey = (id: string) => `wi:req:${id}`;

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async createEndpoint(id: string): Promise<Endpoint> {
    const now = Date.now();
    const ep: Endpoint = { id, createdAt: now, expiresAt: now + ENDPOINT_TTL_SECONDS * 1000, response: null };
    await this.redis.set(epKey(id), ep, { ex: ENDPOINT_TTL_SECONDS });
    return ep;
  }

  async getEndpoint(id: string): Promise<Endpoint | null> {
    return (await this.redis.get<Endpoint>(epKey(id))) ?? null;
  }

  async setResponse(id: string, response: ResponseConfig | null): Promise<void> {
    const ep = await this.getEndpoint(id);
    if (!ep) return;
    const ttl = Math.max(1, Math.round((ep.expiresAt - Date.now()) / 1000));
    await this.redis.set(epKey(id), { ...ep, response }, { ex: ttl });
  }

  async addRequest(id: string, req: CapturedRequest): Promise<void> {
    const ep = await this.getEndpoint(id);
    const expiresAt = Date.now() + ENDPOINT_TTL_SECONDS * 1000;
    const p = this.redis.pipeline();
    p.lpush(reqKey(id), JSON.stringify(req));
    p.ltrim(reqKey(id), 0, MAX_REQUESTS - 1);
    p.expire(reqKey(id), ENDPOINT_TTL_SECONDS);
    if (ep) p.set(epKey(id), { ...ep, expiresAt }, { ex: ENDPOINT_TTL_SECONDS });
    await p.exec();
  }

  async listRequests(id: string): Promise<CapturedRequest[]> {
    const rows = await this.redis.lrange<CapturedRequest | string>(reqKey(id), 0, MAX_REQUESTS - 1);
    // The client auto-parses JSON, but be defensive about string rows.
    return rows.map((r) => (typeof r === "string" ? (JSON.parse(r) as CapturedRequest) : r));
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.redis.del(epKey(id), reqKey(id));
  }
}

interface MemEntry {
  ep: Endpoint;
  reqs: CapturedRequest[];
}

class MemoryStore implements Store {
  private map = new Map<string, MemEntry>();

  private live(id: string): MemEntry | null {
    const e = this.map.get(id);
    if (!e) return null;
    if (e.ep.expiresAt < Date.now()) {
      this.map.delete(id);
      return null;
    }
    return e;
  }

  async createEndpoint(id: string): Promise<Endpoint> {
    const now = Date.now();
    const ep: Endpoint = { id, createdAt: now, expiresAt: now + ENDPOINT_TTL_SECONDS * 1000, response: null };
    this.map.set(id, { ep, reqs: [] });
    return ep;
  }

  async getEndpoint(id: string) {
    return this.live(id)?.ep ?? null;
  }

  async setResponse(id: string, response: ResponseConfig | null) {
    const e = this.live(id);
    if (e) e.ep = { ...e.ep, response };
  }

  async addRequest(id: string, req: CapturedRequest) {
    const e = this.live(id);
    if (!e) return;
    e.reqs.unshift(req);
    e.reqs.length = Math.min(e.reqs.length, MAX_REQUESTS);
    e.ep = { ...e.ep, expiresAt: Date.now() + ENDPOINT_TTL_SECONDS * 1000 };
  }

  async listRequests(id: string) {
    return this.live(id)?.reqs ?? [];
  }

  async deleteEndpoint(id: string) {
    this.map.delete(id);
  }
}

const g = globalThis as unknown as { __wiStore?: Store };

export function getStore(): Store {
  if (!g.__wiStore) {
    const redis = getRedis();
    g.__wiStore = redis ? new RedisStore(redis) : new MemoryStore();
  }
  return g.__wiStore;
}
