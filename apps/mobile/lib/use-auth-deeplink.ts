import { useAuth } from "@nox/features";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";

import { looksLikeAuthCallback, parseAuthCallbackUrl } from "./auth-callback-url";

/**
 * Handles auth redirect links on NATIVE — email confirmation, password reset, OAuth.
 *
 * Every link returns to the app's `nox://auth-callback` deep link carrying either a PKCE `code` or,
 * for some link types, the session tokens themselves in the fragment. Either way the session is
 * established on this device; on success the auth state change drives routing. The web target has
 * its own sibling (`use-auth-deeplink.web.ts`): a browser tab lets supabase-js parse the URL, while
 * the Tauri shell receives the same `nox://` link over the deep-link plugin.
 *
 * Mount once at the root, inside the navigation tree.
 */
export function useAuthDeepLink(): void {
  const { exchangeCodeForSession, setSessionFromTokens, setRecovery } = useAuth();

  useEffect(() => {
    let cancelled = false;
    // A cold-start link can arrive via both getInitialURL and the listener; redeem each once.
    const seen = new Set<string>();

    const fail = (errorCode: string, e?: unknown) => {
      if (e !== undefined) console.warn("[auth] deep-link redemption failed:", e);
      if (!cancelled) router.replace(`/auth-callback?error_code=${encodeURIComponent(errorCode)}`);
    };

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const result = parseAuthCallbackUrl(url);

      switch (result.kind) {
        case "error":
          // Rejected links (expired, already used, prefetched by a mail scanner) carry no code at
          // all. Route to the error screen or the callback route spins forever with nothing to
          // tell it the link failed.
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

    // Cold start: a link may have launched the app.
    Linking.getInitialURL().then((url) => {
      if (!cancelled) void handleUrl(url);
    });
    // Warm: links arriving while the app is already running.
    const sub = Linking.addEventListener("url", ({ url }) => void handleUrl(url));

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [exchangeCodeForSession, setSessionFromTokens, setRecovery]);
}
