import { HIDDEN_HEADER_PREFIXES } from "./config";

/** Hop-by-hop and proxy headers that must not be forwarded on replay. */
const DROP = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "accept-encoding",
  "forwarded",
  "x-real-ip",
]);

export function replayHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (DROP.has(key) || key.startsWith("x-forwarded-")) continue;
    if (HIDDEN_HEADER_PREFIXES.some((p) => key.startsWith(p))) continue;
    out[key] = v;
  }
  return out;
}
