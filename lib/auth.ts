import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isValidId } from "./ids";
import { getStore } from "./store";
import type { Endpoint } from "./types";

/** The public view of an endpoint: everything except its secret. */
export type PublicEndpoint = Omit<Endpoint, "secret">;

export function publicEndpoint({ secret: _secret, ...rest }: Endpoint): PublicEndpoint {
  return rest;
}

function readSecret(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-endpoint-secret");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Load an endpoint and check the caller holds its secret.
 * Returns the endpoint, or a ready-made error response.
 * Unknown endpoints and wrong secrets both return 404 so ids can't be probed.
 */
export async function authorize(req: NextRequest, id: string): Promise<Endpoint | NextResponse> {
  const notFound = NextResponse.json({ error: "not found or expired" }, { status: 404 });
  if (!isValidId(id)) return notFound;
  const ep = await getStore().getEndpoint(id);
  if (!ep) return notFound;
  const secret = readSecret(req);
  if (!secret) return NextResponse.json({ error: "missing endpoint secret" }, { status: 401 });
  if (!ep.secret || !safeEqual(secret, ep.secret)) return notFound;
  return ep;
}
