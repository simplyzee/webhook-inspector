# Webhook Inspector

Capture, inspect and replay webhooks, and forward them to your localhost with one command.

**Live:** https://webhook-inspector.simplyzee.dev

```bash
npx @simplyzee/webhook-inspector listen <endpoint> --to http://localhost:3000
```

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

| Route | Purpose |
| --- | --- |
| `ANY /h/:id/*` | Capture endpoint |
| `POST /api/endpoints` | Create an endpoint |
| `GET /api/endpoints/:id?since=<ms>` | Endpoint and captured requests |
| `PUT /api/endpoints/:id` | Set custom response (`null` resets) |
| `DELETE /api/endpoints/:id` | Burn endpoint |
| `POST /api/endpoints/:id/replay` | Replay to a public URL |

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

# forward to localhost (accepts an id or a full /h/ or /i/ URL)
npx @simplyzee/webhook-inspector listen abc123def456 --to http://localhost:3000

# self-hosted instance
npx @simplyzee/webhook-inspector listen <id> --server https://hooks.example.com --to http://localhost:3000
```

Options: `--interval <ms>`, `--replay-existing`. Set `WEBHOOK_INSPECTOR_SERVER` to change the default server.

Publish it from `cli/` with `npm publish --access public`.

## Security notes

- Endpoint ids are random 60-bit strings. **Anyone with the id can view captured requests**, so treat the URL like a secret and burn it when you're done.
- Server-side replay refuses private, loopback and link-local targets and doesn't follow redirects. Use the CLI for localhost.
- Platform headers (`x-vercel-*`) are stripped before storage.
- Bodies over 256KB are stored truncated. Vercel caps incoming bodies at 4.5MB.

## Roadmap

- [ ] Separate view secret, so sharing the capture URL doesn't expose the inspector
- [ ] Signature verifier for Stripe, GitHub and Slack (paste a secret, see why the HMAC fails)
- [ ] SSE instead of polling
- [ ] Request search and filtering

## License

MIT
