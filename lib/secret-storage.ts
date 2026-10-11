// Browser-only helpers. The secret lives in the URL fragment (#k=…), which
// browsers never send to the server, plus localStorage so a bare /i/<id>
// link still works on the same browser.

const key = (id: string) => `wi:secret:${id}`;

export function saveSecret(id: string, secret: string) {
  try {
    localStorage.setItem(key(id), secret);
  } catch {
    /* storage unavailable (private mode etc.) */
  }
}

export function loadSecret(id: string): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("k");
  if (fromHash) {
    saveSecret(id, fromHash);
    return fromHash;
  }
  try {
    return localStorage.getItem(key(id));
  } catch {
    return null;
  }
}

export function forgetSecret(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}
