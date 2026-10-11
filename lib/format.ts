import type { CapturedRequest } from "./types";

export function prettyBody(r: CapturedRequest): { text: string; kind: "json" | "form" | "text" | "binary" } {
  if (r.bodyEncoding === "base64") return { text: `${r.size} bytes of binary data (base64):\n${r.body}`, kind: "binary" };
  if (!r.body) return { text: "", kind: "text" };
  const ct = (r.headers["content-type"] ?? "").toLowerCase();
  try {
    if (ct.includes("json") || /^\s*[{[]/.test(r.body)) {
      return { text: JSON.stringify(JSON.parse(r.body), null, 2), kind: "json" };
    }
  } catch {
    /* fall through */
  }
  if (ct.includes("x-www-form-urlencoded")) {
    const lines = [...new URLSearchParams(r.body)].map(([k, v]) => `${k} = ${v}`);
    return { text: lines.join("\n"), kind: "form" };
  }
  return { text: r.body, kind: "text" };
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const SKIP_IN_CURL = new Set(["host", "content-length", "connection", "accept-encoding", "x-real-ip", "forwarded"]);

export function toCurl(r: CapturedRequest, target: string): string {
  const parts = [`curl -X ${r.method} ${shellQuote(target + r.path + r.query)}`];
  for (const [k, v] of Object.entries(r.headers)) {
    if (SKIP_IN_CURL.has(k) || k.startsWith("x-forwarded-")) continue;
    parts.push(`-H ${shellQuote(`${k}: ${v}`)}`);
  }
  if (r.body && r.bodyEncoding === "utf8") parts.push(`--data-raw ${shellQuote(r.body)}`);
  if (r.bodyEncoding === "base64") parts.push(`# binary body omitted (${r.size} bytes)`);
  return parts.join(" \\\n  ");
}

export function toFetch(r: CapturedRequest, target: string): string {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.headers)) {
    if (SKIP_IN_CURL.has(k) || k.startsWith("x-forwarded-")) continue;
    headers[k] = v;
  }
  const opts: Record<string, unknown> = { method: r.method, headers };
  if (r.body && r.bodyEncoding === "utf8") opts.body = r.body;
  return `await fetch(${JSON.stringify(target + r.path + r.query)}, ${JSON.stringify(opts, null, 2)});`;
}

export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
