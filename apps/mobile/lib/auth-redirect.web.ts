import { isTauri } from "@nox/db";

/** The deep link Windows routes back to the running app. Already in the Supabase allow-list. */
const DESKTOP_REDIRECT = "nox://auth-callback";

/**
 * Where confirmation / reset links return to on the web target.
 *
 * In a browser tab that's this origin's /auth-callback, and supabase-js picks the session out of the
 * URL itself (`detectSessionInUrl`). In the packaged desktop app it must NOT be the origin: Tauri
 * serves from `http://tauri.localhost` (Windows) or `tauri://localhost` (macOS), neither of which is
 * in the Supabase redirect allow-list, and neither of which an email client can open. So desktop uses
 * the `nox://` scheme, which the installer (or `register_all()` in dev) registers with the OS.
 */
export function authRedirect(): string {
  if (isTauri()) return DESKTOP_REDIRECT;
  return `${window.location.origin}/auth-callback`;
}
