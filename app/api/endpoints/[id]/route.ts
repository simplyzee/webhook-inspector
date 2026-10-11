import { NextRequest, NextResponse } from "next/server";
import { MAX_DELAY_MS } from "@/lib/config";
import { isValidId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import type { ResponseConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Endpoint metadata plus captured requests. `?since=<ms>` returns only newer ones. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const store = getStore();
  const ep = await store.getEndpoint(id);
  if (!ep) return NextResponse.json({ error: "not found or expired" }, { status: 404 });

  const since = Number(req.nextUrl.searchParams.get("since") ?? 0) || 0;
  const requests = (await store.listRequests(id)).filter((r) => r.receivedAt > since);
  return NextResponse.json({ endpoint: ep, requests }, { headers: { "cache-control": "no-store" } });
}

/** Set (or clear with `null`) the custom response the endpoint returns. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const store = getStore();
  if (!(await store.getEndpoint(id))) return NextResponse.json({ error: "not found or expired" }, { status: 404 });

  const input = (await req.json().catch(() => undefined)) as Partial<ResponseConfig> | null | undefined;
  if (input === undefined) return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  let response: ResponseConfig | null = null;
  if (input) {
    const status = Number(input.status ?? 200);
    if (!Number.isInteger(status) || status < 200 || status > 599) {
      return NextResponse.json({ error: "status must be 200–599" }, { status: 400 });
    }
    const body = String(input.body ?? "");
    if (body.length > 16_384) return NextResponse.json({ error: "body too large (16KB max)" }, { status: 400 });
    response = {
      status,
      contentType: String(input.contentType || "application/json").slice(0, 100),
      body,
      delayMs: Math.max(0, Math.min(MAX_DELAY_MS, Number(input.delayMs) || 0)),
    };
  }
  await store.setResponse(id, response);
  return NextResponse.json({ response });
}

/** Burn the endpoint and everything captured on it. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (isValidId(id)) await getStore().deleteEndpoint(id);
  return new NextResponse(null, { status: 204 });
}
