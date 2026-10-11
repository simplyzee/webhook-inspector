import { Ratelimit } from "@upstash/ratelimit";
import { CAPTURE_RATE_PER_MINUTE, CREATE_RATE_PER_HOUR } from "./config";
import { getRedis } from "./store";

type Limiter = { limit(key: string): Promise<{ success: boolean }> };

const noop: Limiter = { limit: async () => ({ success: true }) };

let capture: Limiter | null = null;
let create: Limiter | null = null;

/** Per-endpoint capture limiter. No-op without Redis (local dev). */
export function captureLimiter(): Limiter {
  if (!capture) {
    const redis = getRedis();
    capture = redis
      ? new Ratelimit({ redis, prefix: "wi:rl:cap", limiter: Ratelimit.slidingWindow(CAPTURE_RATE_PER_MINUTE, "1 m") })
      : noop;
  }
  return capture;
}

/** Per-IP endpoint creation limiter. No-op without Redis (local dev). */
export function createLimiter(): Limiter {
  if (!create) {
    const redis = getRedis();
    create = redis
      ? new Ratelimit({ redis, prefix: "wi:rl:new", limiter: Ratelimit.slidingWindow(CREATE_RATE_PER_HOUR, "1 h") })
      : noop;
  }
  return create;
}

export function clientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip");
}
