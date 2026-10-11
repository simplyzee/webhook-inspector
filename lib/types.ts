export type BodyEncoding = "utf8" | "base64";

export interface CapturedRequest {
  id: string;
  method: string;
  /** Path after /h/{endpointId}, always starting with "/" */
  path: string;
  query: string;
  headers: Record<string, string>;
  body: string;
  bodyEncoding: BodyEncoding;
  /** Size of the original body in bytes */
  size: number;
  /** True when the stored body was cut to MAX_STORED_BODY */
  truncated: boolean;
  ip: string | null;
  receivedAt: number;
}

export interface ResponseConfig {
  status: number;
  contentType: string;
  body: string;
  delayMs: number;
}

export interface Endpoint {
  id: string;
  createdAt: number;
  expiresAt: number;
  response: ResponseConfig | null;
}
