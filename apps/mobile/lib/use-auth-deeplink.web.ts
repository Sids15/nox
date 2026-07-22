import { isTauri } from "@nox/db";
import { useAuth } from "@nox/features";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { router } from "expo-router";
import { useEffect } from "react";

/**
 * Read a `nox://auth-callback?code=…` / `…#error=…` link. Supabase puts a success code in the query
 * and a failure in the fragment, so we merge both. `nox:` isn't hierarchical to URL(), hence the
 * swap to https before parsing.
 */
function parseCallback(url: string): { code: string | null; errorCode: string | null } {
  try {
    const u = new URL(url.replace(/^nox:\/\//, "https://"));
    const frag = new URLSearchParams(u.hash.replace(/^#/, ""));
    const error = frag.get("error") ?? u.searchParams.get("error");
    const errorCode = frag.get("error_code") ?? u.searchParams.get("error_code");
    return {
      code: u.searchParams.get("code"),
      errorCode: error || errorCode ? (errorCode ?? "unknown") : null,
    };
  } catch {
    return { code: null, errorCode: null };
  }
}

/**
 * Auth redirect handling on the web target.
 *
 * A plain browser tab needs nothing here — supabase-js reads the session straight out of the page URL
 * (`detectSessionInUrl`), and exchanging again would spend the code twice. Inside Tauri the link never
 * touches the page URL: Windows hands `nox://auth-callback?code=…` to the process, single-instance
 * forwards it to the running window, and we exchange it ourselves. The PKCE verifier is in the same
 * storage the client wrote it to, so the exchange succeeds in-process.
 *
 * A failed link (expired / already used) carries no code, so we push its `error_code` onto
 * /auth-callback as a query param — that screen reads `window.location` and would otherwise never see
 * it, leaving the user on a silent, empty login screen. Only the machine-readable code travels; the
 * screen maps it to fixed copy and never renders Supabase's `error_description`.
 */
export function useAuthDeepLink(): void {
  const { exchangeCodeForSession } = useAuth();

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    // A cold-start link arrives via both getCurrent() and the listener; a spent code throws and would
    // wrongly bounce an already-authed user to login, so exchange each one exactly once.
    const seen = new Set<string>();

    const handleUrl = async (url: string | null | undefined) => {
      if (!url) return;
      const { code, errorCode } = parseCallback(url);

      if (errorCode) {
        if (!cancelled) router.replace(`/auth-callback?error_code=${encodeURIComponent(errorCode)}`);
        return;
      }
      if (!code || seen.has(code)) return;
      seen.add(code);
      try {
        await exchangeCodeForSession(code);
        // Success: onAuthStateChange sets the session (or the recovery flag); the gate routes onward.
      } catch (e) {
        // Land on the error screen, NOT login. Replacing with login is invisible when the user is
        // already there — a failed exchange then looks exactly like the link doing nothing, with no
        // console trace either, which is impossible to diagnose from the outside.
        console.warn("[auth] deep-link code exchange failed:", e);
        if (!cancelled) router.replace("/auth-callback?error_code=exchange_failed");
      }
    };

    // Cold start: the link that launched the app.
    void getCurrent().then((urls) => {
      if (!cancelled) void handleUrl(urls?.[0]);
    });
    // Warm: single-instance forwards the link to this already-running window.
    const unlisten = onOpenUrl((urls) => void handleUrl(urls[0]));

    return () => {
      cancelled = true;
      void unlisten.then((fn) => fn());
    };
  }, [exchangeCodeForSession]);
}
