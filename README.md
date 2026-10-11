# Webhook Inspector

Capture, inspect and replay webhooks, and forward them to your localhost with one command.

**Live:** https://webhook-inspector.simplyzee.dev

```bash
npx @simplyzee/webhook-inspector listen '<private-link>' --to http://localhost:3000
```

Each endpoint has two URLs:

| | Example | Share it? |
| --- | --- | --- |
| **Capture URL** | `…/h/<id>` | Yes. It can only receive requests. |
| **Private link** | `…/i/<id>#k=<key>` | No. The key lets anyone view, replay, reconfigure or burn the endpoint. |

## Features

- **Instant endpoints.** No signup. Every method and every path under `/h/<id>/…` is captured.
- **Exact raw bodies.** Stored byte-for-byte (binary as base64), so HMAC signature checks still pass on replay.
- **Live view.** Headers, query and pretty-printed JSON/form bodies, updated every 2 seconds.
- **Replay.** Re-send any capture to a public URL from the server, or copy it as `curl` / `fetch`.
- **Localhost forwarding.** The zero-dependency CLI polls your endpoint and forwards new requests to your dev server. No tunnel needed.
- **Custom responses.** Set the status, body, content type and delay (up to 10s) to test retries and timeouts.
- **Ephemeral by default.** The last 100 requests are kept, and endpoints expire after 24h without traffic. Burn them anytime.

## How it works

```
Stripe / GitHub ──► /h/<id>/any/path ──► Upstash Redis (capped list, 24h TTL)
                                              │
                    browser /i/<id> ◄── poll ─┤
                    CLI (your machine) ◄─ poll┘──► http://localhost:3000
```

| Route | Purpose | Auth |
| --- | --- | --- |
| `ANY /h/:id/*` | Capture endpoint | none |
| `POST /api/endpoints` | Create an endpoint; returns `{ id, secret }` once | none (rate limited) |
| `GET /api/endpoints/:id?since=<ms>` | Endpoint and captured requests | key |
| `PUT /api/endpoints/:id` | Set custom response (`null` resets) | key |
| `DELETE /api/endpoints/:id` | Burn endpoint | key |
| `POST /api/endpoints/:id/replay` | Replay to a public URL | key |

Send the key as `Authorization: Bearer <key>`.

## Run locally

```bash
npm install
npm run dev
```

Without Redis credentials it uses an in-memory store, which is fine for development. Rate limiting is only active with Redis.

## Deploy to Vercel

1. Import the repo into Vercel.
2. Add **Upstash Redis** from the Vercel Marketplace (Storage tab). It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Plain `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.
3. Add your domain (e.g. `webhook-inspector.simplyzee.dev`) under Settings → Domains.

## CLI

```bash
# create an endpoint
npx @simplyzee/webhook-inspector new

# forward to localhost using the private link (quote it because of the #)
npx @simplyzee/webhook-inspector listen 'https://webhook-inspector.simplyzee.dev/i/<id>#k=<key>' --to http://localhost:3000

# or pass the key separately
npx @simplyzee/webhook-inspector listen <id> --secret <key> --to http://localhost:3000
```

Options: `--secret <key>`, `--server <url>`, `--interval <ms>`, `--replay-existing`. Environment variables: `WEBHOOK_INSPECTOR_SECRET`, `WEBHOOK_INSPECTOR_SERVER`.

Publish it from `cli/` with `npm publish --access public`.

## Security notes

- Every endpoint has a 120-bit key, required to view, replay, reconfigure or burn it. The capture URL alone exposes nothing.
- In the browser, the key lives in the URL fragment (`#k=…`), which browsers never send to servers, so it stays out of access logs and `Referer` headers. It's also remembered in `localStorage` so `/i/<id>` reopens on the same browser.
- A wrong key returns the same 404 as an unknown endpoint, so ids can't be probed.
- Server-side replay refuses private, loopback and link-local targets and doesn't follow redirects. Use the CLI for localhost.
- Platform headers (`x-vercel-*`) are stripped before storage.
- Bodies over 256KB are stored truncated. Vercel caps incoming bodies at 4.5MB.

## Roadmap

- [x] Separate view secret, so sharing the capture URL doesn't expose the inspector
- [ ] Signature verifier for Stripe, GitHub and Slack (paste a secret, see why the HMAC fails)
- [ ] SSE instead of polling
- [ ] Request search and filtering

## License

MIT
