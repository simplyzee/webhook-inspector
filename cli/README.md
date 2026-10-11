# @simplyzee/webhook-inspector

Forward webhooks captured by [Webhook Inspector](https://webhook-inspector.simplyzee.dev) to your local dev server. Zero dependencies, Node 18+.

```bash
npx @simplyzee/webhook-inspector new
npx @simplyzee/webhook-inspector listen <endpoint-id-or-url> --to http://localhost:3000
```

Original method, path, query, headers and raw body are preserved, so webhook signature checks still pass. Forwarded requests carry an extra `x-webhook-inspector-replay: 1` header.

| Option | Default |
| --- | --- |
| `--to <url>` | required for `listen` |
| `--server <url>` | `https://webhook-inspector.simplyzee.dev` (or `WEBHOOK_INSPECTOR_SERVER`) |
| `--interval <ms>` | `1000` |
| `--replay-existing` | off |

Source: https://github.com/simplyzee/webhook-inspector
