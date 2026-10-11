import { MAX_STORED_BODY } from "./config";
import type { BodyEncoding } from "./types";

/** Store text bodies as-is when they're valid UTF-8, otherwise base64. */
export function encodeBody(buf: Uint8Array): { body: string; bodyEncoding: BodyEncoding; truncated: boolean } {
  const truncated = buf.byteLength > MAX_STORED_BODY;
  const slice = truncated ? buf.subarray(0, MAX_STORED_BODY) : buf;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(slice);
    return { body: text, bodyEncoding: "utf8", truncated };
  } catch {
    return { body: Buffer.from(slice).toString("base64"), bodyEncoding: "base64", truncated };
  }
}

export function decodeBody(body: string, enc: BodyEncoding): Buffer {
  return enc === "base64" ? Buffer.from(body, "base64") : Buffer.from(body, "utf8");
}
