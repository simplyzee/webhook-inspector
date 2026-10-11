#!/usr/bin/env node
// Webhook Inspector CLI: polls an endpoint and forwards new requests to a local server.
// Zero dependencies, Node 18+.

const DEFAULT_SERVER = process.env.WEBHOOK_INSPECTOR_SERVER || "https://webhook-inspector.simplyzee.dev";
const DROP = new Set([
  "host", "connection", "content-length", "transfer-encoding", "keep-alive", "upgrade",
  "accept-encoding", "forwarded", "x-real-ip",
]);

const c = process.stdout.isTTY && !process.env.NO_COLOR
  ? { dim: (s) => `\x1b[2m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` }
  : { dim: (s) => s, green: (s) => s, red: (s) => s, yellow: (s) => s, bold: (s) => s };

function usage(code = 0) {
  console.log(`
${c.bold("webhook-inspector")} - forward captured webhooks to localhost

Usage:
  webhook-inspector listen <endpoint> --to <url> [options]
  webhook-inspector new [--server <url>]

<endpoint> is an endpoint id, or a full /h/<id> or /i/<id> URL.

Options:
  --to <url>        Local target, e.g. http://localhost:3000 (required for listen)
  --server <url>    Inspector server (default: ${DEFAULT_SERVER})
  --interval <ms>   Poll interval (default: 1000)
  --replay-existing Also forward requests captured before the CLI started
  -h, --help        Show this help
`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--replay-existing") out.replayExisting = true;
    else if (a.startsWith("--")) {
      const [k, v] = a.includes("=") ? a.slice(2).split(/=(.*)/s) : [a.slice(2), argv[++i]];
      if (v === undefined) { console.error(c.red(`Missing value for --${k}`)); process.exit(1); }
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

function resolveEndpoint(input, serverFlag) {
  let server = (serverFlag || DEFAULT_SERVER).replace(/\/$/, "");
  let id = input;
  if (/^https?:\/\//.test(input)) {
    const u = new URL(input);
    const m = u.pathname.match(/^\/(?:h|i)\/([a-z0-9]+)/);
    if (!m) { console.error(c.red("Couldn't find an endpoint id in that URL")); process.exit(1); }
    id = m[1];
    if (!serverFlag) server = u.origin;
  }
  if (!/^[a-z0-9]{6,32}$/.test(id)) { console.error(c.red(`Invalid endpoint id: ${id}`)); process.exit(1); }
  return { server, id };
}

function forwardHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (DROP.has(key) || key.startsWith("x-forwarded-") || key.startsWith("x-vercel-")) continue;
    out[key] = v;
  }
  out["x-webhook-inspector-replay"] = "1";
  return out;
}

async function forward(r, to) {
  const url = to.replace(/\/$/, "") + r.path + r.query;
  const hasBody = !["GET", "HEAD"].includes(r.method) && r.body;
  const body = hasBody ? Buffer.from(r.body, r.bodyEncoding === "base64" ? "base64" : "utf8") : undefined;
  const started = Date.now();
  const tag = `${c.bold(r.method.padEnd(6))} ${r.path}${r.query}`;
  if (r.truncated) console.log(c.yellow(`  ! ${r.id}: body was truncated on capture; forwarding what was stored`));
  try {
    const res = await fetch(url, { method: r.method, headers: forwardHeaders(r.headers), body, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    await res.arrayBuffer().catch(() => {});
    const status = res.status < 400 ? c.green(res.status) : c.red(res.status);
    console.log(`${c.dim(new Date().toLocaleTimeString())}  ${tag}  → ${status} ${c.dim(`${Date.now() - started}ms`)}`);
  } catch (e) {
    const reason = e.cause?.code === "ECONNREFUSED" ? `nothing listening on ${to}` : e.message;
    console.log(`${c.dim(new Date().toLocaleTimeString())}  ${tag}  → ${c.red(`failed: ${reason}`)}`);
  }
}

async function listen(args) {
  if (!args._[1] || !args.to) usage(1);
  const { server, id } = resolveEndpoint(args._[1], args.server);
  const interval = Math.max(250, Number(args.interval) || 1000);
  const api = `${server}/api/endpoints/${id}`;

  let since = 0;
  const first = await fetch(api).catch((e) => ({ ok: false, status: 0, statusText: e.message }));
  if (!first.ok) {
    console.error(c.red(first.status === 404 ? "Endpoint not found or expired." : `Couldn't reach ${server} (${first.status || first.statusText})`));
    process.exit(1);
  }
  const initial = await first.json();
  if (args.replayExisting) {
    for (const r of [...initial.requests].reverse()) await forward(r, args.to);
  }
  // Use server timestamps only, so clock skew between machines can't drop requests.
  since = Math.max(0, ...initial.requests.map((r) => r.receivedAt));

  console.log(`\n  ${c.green("●")} Forwarding ${c.bold(`${server}/h/${id}`)} → ${c.bold(args.to)}`);
  console.log(c.dim(`    Inspect at ${server}/i/${id}  ·  Ctrl+C to stop\n`));

  const seen = new Set(initial.requests.map((r) => r.id));
  let failures = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, interval));
    try {
      const res = await fetch(`${api}?since=${since}`, { signal: AbortSignal.timeout(10_000) });
      if (res.status === 404) { console.error(c.red("Endpoint expired or was deleted. Stopping.")); process.exit(1); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { requests } = await res.json();
      const fresh = requests.filter((r) => !seen.has(r.id)).sort((a, b) => a.receivedAt - b.receivedAt);
      for (const r of fresh) {
        seen.add(r.id);
        since = Math.max(since, r.receivedAt);
        await forward(r, args.to);
      }
      if (failures) console.log(c.dim("  reconnected"));
      failures = 0;
    } catch (e) {
      if (++failures === 1) console.log(c.yellow(`  ! polling failed (${e.message}), retrying…`));
    }
  }
}

async function create(args) {
  const server = (args.server || DEFAULT_SERVER).replace(/\/$/, "");
  const res = await fetch(`${server}/api/endpoints`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) { console.error(c.red(data.error || `HTTP ${res.status}`)); process.exit(1); }
  console.log(`Endpoint: ${c.bold(`${server}/h/${data.id}`)}\nInspect:  ${server}/i/${data.id}\nForward:  webhook-inspector listen ${data.id} --to http://localhost:3000`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (args.help || !cmd) usage(cmd ? 0 : 1);
if (cmd === "listen") await listen(args);
else if (cmd === "new") await create(args);
else usage(1);
