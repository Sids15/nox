// AES-GCM for the Google refresh tokens at rest (key: GCAL_TOKEN_KEY, 32 random bytes, base64).
// Web Crypto only, so it runs in Deno and in tests.

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = unb64(base64Key);
  if (raw.length !== 32) throw new Error("GCAL_TOKEN_KEY must be 32 bytes (base64)");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** "v1.<iv>.<ciphertext>" */
export async function seal(key: CryptoKey, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function open(key: CryptoKey, sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("bad token");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
  return new TextDecoder().decode(plain);
}

/** PKCE: a verifier and its S256 challenge (base64url). */
export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const verifier = url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge: url(digest) };
}

/** Where the browser may be sent back to after connecting: only the listed prefixes. */
export function safeReturn(to: unknown, allowed: string[], fallback: string): string {
  if (typeof to !== "string" || to.length > 500) return fallback;
  return allowed.some((p) => p && (to === p || to.startsWith(p.endsWith("/") ? p : `${p}/`) || to.startsWith(`${p}?`))) ? to : fallback;
}
