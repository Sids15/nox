/**
 * Parses an auth redirect URL into the one thing the app should do with it.
 *
 * Supabase hands back a session in two different shapes depending on the link and the project's
 * flow settings, and a deep link can carry either:
 *
 * - **PKCE** — `?code=…` in the query, exchanged for a session on the device that started the flow.
 * - **Implicit** — `#access_token=…&refresh_token=…&type=…` in the fragment, already a session.
 *
 * Errors arrive in the fragment (`#error=…&error_code=…`) regardless. Handling only one shape means
 * the other is silently ignored: the app sits on whatever screen it was on, with no error and no
 * session, which is indistinguishable from the link doing nothing.
 *
 * Scheme-agnostic on purpose — the same URL arrives as `nox://…` (desktop/native), `exp://…/--/…`
 * (Expo Go) or `http://localhost:8081/…` (browser), and `new URL()` treats those inconsistently. We
 * slice the query and fragment off by hand instead.
 */
export type AuthCallback =
  | { kind: "code"; code: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string; recovery: boolean }
  | { kind: "error"; errorCode: string }
  /** Nothing actionable. `keys` is the parameter NAMES only — never values, which are secrets. */
  | { kind: "none"; keys: string[] };

export function parseAuthCallbackUrl(url: string): AuthCallback {
  const hashAt = url.indexOf("#");
  const fragment = hashAt === -1 ? "" : url.slice(hashAt + 1);
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  const query = queryAt === -1 ? "" : beforeHash.slice(queryAt + 1);

  const params = new URLSearchParams();
  for (const source of [query, fragment]) {
    for (const [key, value] of new URLSearchParams(source)) {
      if (!params.has(key)) params.set(key, value);
    }
  }

  const error = params.get("error");
  const errorCode = params.get("error_code");
  if (error || errorCode) return { kind: "error", errorCode: errorCode ?? "unknown" };

  const code = params.get("code");
  if (code) return { kind: "code", code };

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return {
      kind: "tokens",
      accessToken,
      refreshToken,
      // setSession() emits SIGNED_IN, not PASSWORD_RECOVERY, so the recovery gate would never fire
      // and a reset link would drop the user into the app instead of the new-password screen.
      recovery: params.get("type") === "recovery",
    };
  }

  return { kind: "none", keys: [...params.keys()] };
}
