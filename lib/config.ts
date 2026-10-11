/** How long an endpoint and its requests live, refreshed on every capture. */
export const ENDPOINT_TTL_SECONDS = 60 * 60 * 24;

/** How many requests are kept per endpoint (newest first). */
export const MAX_REQUESTS = 100;

/** Bodies larger than this are stored truncated. Vercel itself caps at 4.5MB. */
export const MAX_STORED_BODY = 256 * 1024;

/** Upper bound for the configurable response delay. */
export const MAX_DELAY_MS = 10_000;

/** Captures allowed per endpoint per minute (only enforced with Redis). */
export const CAPTURE_RATE_PER_MINUTE = 120;

/** Endpoint creations allowed per IP per hour (only enforced with Redis). */
export const CREATE_RATE_PER_HOUR = 30;

/** Headers added by the platform that shouldn't be shown or replayed. */
export const HIDDEN_HEADER_PREFIXES = ["x-vercel-", "x-middleware-", "x-matched-path", "x-invoke-", "x-nextjs-"];
