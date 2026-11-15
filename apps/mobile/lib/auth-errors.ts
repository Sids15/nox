/**
 * Turn a raw Supabase auth error into human copy for the common cases. Falls back to the original
 * message so nothing is ever swallowed.
 */
export function authErrorMessage(e: unknown): string {
  // A validation error (Zod) carries its issues as JSON in `message`; show the first issue's
  // sentence, never the raw dump.
  const issues = (e as { issues?: { message?: string }[] } | null)?.issues;
  if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong";
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email or password isn't right.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists — try signing in.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("password should be")) return "Password must be at least 8 characters.";
  if (m.includes("network") || m.includes("fetch")) return "Network error — check your connection.";
  return raw;
}
