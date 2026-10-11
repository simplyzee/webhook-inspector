import { NextRequest, NextResponse } from "next/server";
import { decodeBody } from "@/lib/body";
import { isValidId } from "@/lib/ids";
import { replayHeaders } from "@/lib/replay";
import { assertPublicUrl } from "@/lib/ssrf";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Replay a captured request to a public URL from the server. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { requestId, target } = ((await req.json().catch(() => ({}))) ?? {}) as { requestId?: string; target?: string };
  if (!requestId || !target) return NextResponse.json({ error: "requestId and target are required" }, { status: 400 });

  const captured = (await getStore().listRequests(id)).find((r) => r.id === requestId);
  if (!captured) return NextResponse.json({ error: "request not found" }, { status: 404 });
  if (captured.truncated) return NextResponse.json({ error: "body was truncated on capture; can't replay faithfully" }, { status: 422 });

  let url: URL;
  try {
    url = await assertPublicUrl(target);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const hasBody = !["GET", "HEAD"].includes(captured.method);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: captured.method,
      headers: replayHeaders(captured.headers),
      body: hasBody ? new Uint8Array(decodeBody(captured.body, captured.bodyEncoding)) : undefined,
      redirect: "manual", // don't follow redirects into private networks
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    return NextResponse.json({
      status: res.status,
      durationMs: Date.now() - started,
      headers: Object.fromEntries(res.headers),
      body: text.slice(0, 16_384),
    });
  } catch (e) {
    return NextResponse.json({ error: `Replay failed: ${(e as Error).message}` }, { status: 502 });
  }
}
