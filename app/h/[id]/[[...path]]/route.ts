import { NextRequest, NextResponse } from "next/server";
import { encodeBody } from "@/lib/body";
import { HIDDEN_HEADER_PREFIXES, MAX_DELAY_MS } from "@/lib/config";
import { isValidId, newId } from "@/lib/ids";
import { captureLimiter, clientIp } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";
import type { CapturedRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; path?: string[] }> };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "*",
  "access-control-allow-headers": "*",
};

async function capture(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id, path = [] } = await ctx.params;
  if (!isValidId(id)) return NextResponse.json({ error: "unknown endpoint" }, { status: 404, headers: CORS });

  const store = getStore();
  const ep = await store.getEndpoint(id);
  if (!ep) return NextResponse.json({ error: "unknown or expired endpoint" }, { status: 404, headers: CORS });

  const { success } = await captureLimiter().limit(id);
  if (!success) return NextResponse.json({ error: "rate limited" }, { status: 429, headers: CORS });

  const buf = new Uint8Array(await req.arrayBuffer());
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (!HIDDEN_HEADER_PREFIXES.some((p) => k.startsWith(p))) headers[k] = v;
  });

  const record: CapturedRequest = {
    id: newId(10),
    method: req.method,
    path: "/" + path.map(encodeURIComponent).join("/"),
    query: req.nextUrl.search,
    headers,
    ...encodeBody(buf),
    size: buf.byteLength,
    ip: clientIp(req.headers),
    receivedAt: Date.now(),
  };
  await store.addRequest(id, record);

  const r = ep.response;
  if (r?.delayMs) await new Promise((res) => setTimeout(res, Math.min(r.delayMs, MAX_DELAY_MS)));
  if (r) {
    return new Response(r.body, {
      status: r.status,
      headers: { ...CORS, "content-type": r.contentType || "text/plain" },
    });
  }
  return NextResponse.json({ ok: true, id: record.id }, { headers: CORS });
}

export const GET = capture;
export const POST = capture;
export const PUT = capture;
export const PATCH = capture;
export const DELETE = capture;
export const HEAD = capture;
export const OPTIONS = capture;
