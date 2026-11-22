/** The role inside a legacy Supabase JWT key ("anon" / "service_role"), or null if it isn't one. */
function jwtRole(key: string): string | null {
  const part = key.split(".")[1];
  // Reached through globalThis: the packages that import @nox/db don't all include the DOM types.
  const decode = (globalThis as { atob?: (s: string) => string }).atob;
  if (!part || typeof decode !== "function") return null;
  try {
    const json = decode(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Refuse to start with a server key in the client: a `sb_secret_…` key or a `service_role` JWT
 * bypasses Row Level Security, and anything in EXPO_PUBLIC_* is readable by every user.
 */
export function isPublicSupabaseKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return false;
  if (key.startsWith("eyJ")) return jwtRole(key) !== "service_role";
  return true;
}
