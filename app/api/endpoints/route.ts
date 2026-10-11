import { NextRequest, NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { clientIp, createLimiter } from "@/lib/ratelimit";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a new capture endpoint. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers) ?? "unknown";
  const { success } = await createLimiter().limit(ip);
  if (!success) return NextResponse.json({ error: "Too many endpoints created. Try again later." }, { status: 429 });

  // 24 chars from a 32-char alphabet = 120 bits. Only returned here, once.
  const ep = await getStore().createEndpoint(newId(), newId(24));
  return NextResponse.json(ep, { status: 201, headers: { "cache-control": "no-store" } });
}
