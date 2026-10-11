import { CreateButton } from "./create-button";

export default function Home() {
  return (
    <main className="landing">
      <p className="eyebrow">open source · no signup · 24h retention</p>
      <h1>
        Webhook <span className="accent">Inspector</span>
      </h1>
      <p className="lede">
        Get a URL, point Stripe, GitHub or anything else at it, and watch requests land in real time. Replay them
        anywhere, including your localhost.
      </p>
      <CreateButton />
      <pre className="snippet">
        <span className="dim"># forward live webhooks to your dev server</span>
        {"\n"}npx @simplyzee/webhook-inspector listen &lt;endpoint&gt; --to http://localhost:3000
      </pre>
      <ul className="features">
        <li>
          <strong>Every method, every path.</strong> Headers, query and the exact raw body, so signature checks still
          work.
        </li>
        <li>
          <strong>Replay.</strong> Re-send any capture to a public URL, or to localhost through the CLI.
        </li>
        <li>
          <strong>Custom responses.</strong> Pick the status, body and delay to test retries and timeouts.
        </li>
        <li>
          <strong>Burn it.</strong> Endpoints expire after 24h of quiet, or delete them in one click.
        </li>
      </ul>
      <footer>
        <a href="https://github.com/simplyzee/webhook-inspector">GitHub</a>
      </footer>
    </main>
  );
}
