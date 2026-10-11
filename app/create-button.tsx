"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/endpoints", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create endpoint");
      router.push(`/i/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="primary big" onClick={create} disabled={busy}>
        {busy ? "Creating…" : "Create endpoint"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
