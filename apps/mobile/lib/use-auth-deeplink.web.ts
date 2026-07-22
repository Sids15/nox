import { isTauri } from "@nox/db";
import { useAuth } from "@nox/features";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { router } from "expo-router";
import { useEffect } from "react";

import { looksLikeAuthCallback, parseAuthCallbackUrl } from "./auth-callback-url";

/**
 * Auth redirect handling on the web target.
 *
 * A plain browser tab needs nothing here — supabase-js reads the session straight out of the page URL
 * (`detectSessionInUrl`), and handling it again would spend the code twice. Inside Tauri the link never
 * touches the page URL: Windows hands `nox://auth-callback…` to the process, single-instance forwards
 * it to the running window, and we redeem it ourselves. Whatever storage the client wrote the PKCE
 * verifier to is the same storage we read it from, so the exchange succeeds in-process.
 *
 * Mount once at the root, inside the navigation tree.
 */
export function useAuthDeepLink(): void {
  const { exchangeCodeForSession, setSessionFromTokens, setRecovery } = useAuth();

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    // A cold-start link arrives via both getCurrent() and the listener; redeem each exactly once. A
    // spent code throws and would wrongly bounce an already-authed user out.
    const seen = new Set<string>();

    const fail = (errorCode: string, e?: unknown) => {
      if (e !== undefined) console.warn("[auth] deep-link redemption failed:", e);
      if (!cancelled) router.replace(`/auth-callback?error_code=${encodeURIComponent(errorCode)}`);
    };

    const handleUrl = async (url: string | null | undefined) => {
      if (!url) return;
      const result = parseAuthCallbackUrl(url);

      switch (result.kind) {
        case "error":
          if (!cancelled) {
            router.replace(`/auth-callback?error_code=${encodeURIComponent(result.errorCode)}`);
          }
          return;

        case "code":
          if (seen.has(result.code)) return;
          seen.add(result.code);
          try {
            await exchangeCodeForSession(result.code);
          } catch (e) {
            fail("exchange_failed", e);
          }
          return;

        case "tokens":
          if (seen.has(result.accessToken)) return;
          seen.add(result.accessToken);
          try {
            await setSessionFromTokens(result.accessToken, result.refreshToken);
            // setSession emits SIGNED_IN, never PASSWORD_RECOVERY, so raise the flag ourselves or
            // a reset link lands the user in the app instead of on the new-password screen.
            if (result.recovery && !cancelled) setRecovery(true);
          } catch (e) {
            fail("exchange_failed", e);
          }
          return;

        case "none":
          // Only noteworthy if the link claimed to be an auth callback; a plain launch URL lands
          // here on every cold start and must not cry wolf.
          if (looksLikeAuthCallback(url)) {
            console.warn("[auth] auth-callback link had no code, tokens or error. Params:", result.keys);
          }
          return;
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
  }, [exchangeCodeForSession, setSessionFromTokens, setRecovery]);
}
