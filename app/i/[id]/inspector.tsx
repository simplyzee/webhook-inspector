"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bytes, prettyBody, timeAgo, toCurl, toFetch } from "@/lib/format";
import type { CapturedRequest, Endpoint, ResponseConfig } from "@/lib/types";

const POLL_MS = 2000;
type Tab = "body" | "headers" | "query" | "replay";

export function Inspector({ id }: { id: string }) {
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "gone">("loading");
  const [now, setNow] = useState(() => Date.now());
  const [origin, setOrigin] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const since = useRef(0);

  useEffect(() => setOrigin(window.location.origin), []);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/endpoints/${id}?since=${since.current}`, { cache: "no-store" }).catch(() => null);
    if (!res) return;
    if (res.status === 404) return setState("gone");
    const data = (await res.json()) as { endpoint: Endpoint; requests: CapturedRequest[] };
    setEndpoint(data.endpoint);
    setState("ok");
    if (data.requests.length) {
      since.current = Math.max(since.current, ...data.requests.map((r) => r.receivedAt));
      setRequests((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...data.requests.filter((r) => !seen.has(r.id)), ...prev].slice(0, 100);
      });
      setSelected((s) => s ?? data.requests[0].id);
    }
  }, [id]);

  useEffect(() => {
    poll();
    const t = setInterval(() => {
      if (!document.hidden) poll();
      setNow(Date.now());
    }, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  async function burn() {
    if (!confirm("Delete this endpoint and everything captured on it?")) return;
    await fetch(`/api/endpoints/${id}`, { method: "DELETE" });
    window.location.href = "/";
  }

  if (state === "gone") {
    return (
      <main className="landing">
        <h1>Endpoint not found</h1>
        <p className="lede">It may have expired after 24 hours of quiet, or been deleted.</p>
        <a className="primary big" href="/">
          Create a new one
        </a>
      </main>
    );
  }

  const url = `${origin}/h/${id}`;
  const current = requests.find((r) => r.id === selected) ?? null;

  return (
    <div className="app">
      <header className="bar">
        <a href="/" className="brand">
          webhook<span className="accent">/</span>inspector
        </a>
        <div className="url">
          <code>{url}</code>
          <CopyButton text={url} />
        </div>
        <div className="bar-actions">
          <button onClick={() => setShowResponse((v) => !v)} className={endpoint?.response ? "on" : ""}>
            Response{endpoint?.response ? ` · ${endpoint.response.status}` : ""}
          </button>
          <button className="danger" onClick={burn}>
            Burn
          </button>
        </div>
      </header>

      {showResponse && endpoint && (
        <ResponseEditor id={id} initial={endpoint.response} onSaved={(r) => setEndpoint({ ...endpoint, response: r })} />
      )}

      <div className="split">
        <aside className="list" aria-label="Captured requests">
          {requests.length === 0 ? (
            <Empty url={url} id={id} origin={origin} />
          ) : (
            requests.map((r) => (
              <button
                key={r.id}
                className={`row ${r.id === selected ? "sel" : ""}`}
                onClick={() => setSelected(r.id)}
              >
                <span className={`method m-${r.method.toLowerCase()}`}>{r.method}</span>
                <span className="path">
                  {r.path}
                  {r.query}
                </span>
                <span className="meta">
                  {timeAgo(r.receivedAt, now)} · {bytes(r.size)}
                </span>
              </button>
            ))
          )}
        </aside>
        <section className="detail">
          {current ? (
            <Detail key={current.id} r={current} id={id} origin={origin} />
          ) : (
            <p className="dim pad">{requests.length ? "Select a request" : "Waiting for the first request…"}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Empty({ url, id, origin }: { url: string; id: string; origin: string }) {
  const curl = `curl -X POST ${url}/test -H 'content-type: application/json' -d '{"hello":"world"}'`;
  return (
    <div className="empty">
      <span className="pulse" /> Listening…
      <p className="dim">Send something to try it:</p>
      <pre>{curl}</pre>
      <CopyButton text={curl} label="Copy curl" />
      <p className="dim">Or forward to localhost:</p>
      <pre>{`npx @simplyzee/webhook-inspector listen ${id} --server ${origin} --to http://localhost:3000`}</pre>
    </div>
  );
}

function Detail({ r, id, origin }: { r: CapturedRequest; id: string; origin: string }) {
  const [tab, setTab] = useState<Tab>("body");
  const body = prettyBody(r);
  const query = [...new URLSearchParams(r.query)];

  return (
    <div>
      <div className="detail-head">
        <span className={`method m-${r.method.toLowerCase()}`}>{r.method}</span>
        <code className="path">
          {r.path}
          {r.query}
        </code>
        <span className="dim">
          {new Date(r.receivedAt).toLocaleString()} · {bytes(r.size)}
          {r.ip ? ` · ${r.ip}` : ""}
        </span>
      </div>
      <nav className="tabs">
        {(["body", "headers", "query", "replay"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "sel" : ""} onClick={() => setTab(t)}>
            {t}
            {t === "headers" ? ` (${Object.keys(r.headers).length})` : t === "query" && query.length ? ` (${query.length})` : ""}
          </button>
        ))}
      </nav>

      {tab === "body" && (
        <div className="pane">
          {r.truncated && <p className="warn">Body was larger than the storage limit and has been truncated.</p>}
          {body.text ? (
            <>
              <div className="pane-actions">
                <span className="dim">{body.kind}</span>
                <CopyButton text={r.bodyEncoding === "utf8" ? r.body : body.text} label="Copy raw" />
              </div>
              <pre className="code">{body.text}</pre>
            </>
          ) : (
            <p className="dim">No body</p>
          )}
        </div>
      )}

      {tab === "headers" && (
        <div className="pane">
          <KV rows={Object.entries(r.headers).sort(([a], [b]) => a.localeCompare(b))} />
        </div>
      )}

      {tab === "query" && (
        <div className="pane">{query.length ? <KV rows={query} /> : <p className="dim">No query parameters</p>}</div>
      )}

      {tab === "replay" && <Replay r={r} id={id} origin={origin} />}
    </div>
  );
}

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <table className="kv">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={`${k}-${i}`}>
            <th>{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Replay({ r, id, origin }: { r: CapturedRequest; id: string; origin: string }) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status?: number; durationMs?: number; body?: string; error?: string } | null>(
    null,
  );
  const base = target.replace(/\/$/, "") || "https://example.com";

  async function send() {
    setBusy(true);
    setResult(null);
    const res = await fetch(`/api/endpoints/${id}/replay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: r.id, target: target + (target.endsWith("/") ? r.path.slice(1) : r.path) + r.query }),
    });
    setResult(await res.json());
    setBusy(false);
  }

  return (
    <div className="pane">
      <label className="field">
        <span>Replay to a public URL (path and query are appended)</span>
        <div className="inline">
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://api.example.com" />
          <button className="primary" onClick={send} disabled={busy || !target}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </label>
      {result && (
        <div className={`result ${result.error ? "bad" : (result.status ?? 0) < 400 ? "good" : "bad"}`}>
          {result.error ? (
            result.error
          ) : (
            <>
              <strong>{result.status}</strong> in {result.durationMs}ms
              {result.body && <pre className="code">{result.body}</pre>}
            </>
          )}
        </div>
      )}

      <p className="dim">Localhost? Run the CLI and it'll forward new requests as they arrive:</p>
      <pre className="code">{`npx @simplyzee/webhook-inspector listen ${id} --server ${origin} --to http://localhost:3000`}</pre>

      <div className="pane-actions">
        <span className="dim">Copy as</span>
        <CopyButton text={toCurl(r, base)} label="curl" />
        <CopyButton text={toFetch(r, base)} label="fetch" />
      </div>
    </div>
  );
}

function ResponseEditor({
  id,
  initial,
  onSaved,
}: {
  id: string;
  initial: ResponseConfig | null;
  onSaved: (r: ResponseConfig | null) => void;
}) {
  const [status, setStatus] = useState(String(initial?.status ?? 200));
  const [contentType, setContentType] = useState(initial?.contentType ?? "application/json");
  const [body, setBody] = useState(initial?.body ?? '{"ok":true}');
  const [delayMs, setDelayMs] = useState(String(initial?.delayMs ?? 0));
  const [msg, setMsg] = useState<string | null>(null);

  async function save(clear = false) {
    const res = await fetch(`/api/endpoints/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(clear ? null : { status: Number(status), contentType, body, delayMs: Number(delayMs) }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error);
    onSaved(data.response);
    setMsg(clear ? "Reset to default 200" : "Saved");
  }

  return (
    <div className="response-editor">
      <div className="grid">
        <label className="field">
          <span>Status</span>
          <input value={status} onChange={(e) => setStatus(e.target.value)} inputMode="numeric" />
        </label>
        <label className="field">
          <span>Content-Type</span>
          <input value={contentType} onChange={(e) => setContentType(e.target.value)} />
        </label>
        <label className="field">
          <span>Delay (ms, max 10000)</span>
          <input value={delayMs} onChange={(e) => setDelayMs(e.target.value)} inputMode="numeric" />
        </label>
      </div>
      <label className="field">
        <span>Body</span>
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="inline">
        <button className="primary" onClick={() => save()}>
          Save response
        </button>
        <button onClick={() => save(true)}>Reset</button>
        {msg && <span className="dim">{msg}</span>}
      </div>
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
