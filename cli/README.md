# @simplyzee/webhook-inspector

Forward webhooks captured by [Webhook Inspector](https://webhook-inspector.simplyzee.dev) to your local dev server. Zero dependencies, Node 18+.

```bash
# create an endpoint: prints the capture URL and your private link
npx @simplyzee/webhook-inspector new

# forward to localhost (quote the link because of the #)
npx @simplyzee/webhook-inspector listen 'https://webhook-inspector.simplyzee.dev/i/<id>#k=<key>' --to http://localhost:3000
```

Original method, path, query, headers and raw body are preserved, so webhook signature checks still pass. Forwarded requests carry an extra `x-webhook-inspector-replay: 1` header.

| Option | Default |
| --- | --- |
| `--to <url>` | required for `listen` |
| `--secret <key>` | from the link's `#k=`, or `WEBHOOK_INSPECTOR_SECRET` |
| `--server <url>` | from the link, or `https://webhook-inspector.simplyzee.dev` (`WEBHOOK_INSPECTOR_SERVER`) |
| `--interval <ms>` | `1000` |
| `--replay-existing` | off |

The capture URL (`/h/<id>`) is safe to give to webhook senders. The private link contains your key, so keep it to yourself.

Source: https://github.com/simplyzee/webhook-inspector
