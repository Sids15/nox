import { useAuth } from "@nox/features";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";

/** expo-linking types a query param as string | string[]; only a lone string is meaningful here. */
function asString(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * Handles auth redirect links on NATIVE — email confirmation, password reset (and, later, OAuth).
 * Every link returns to `nox://auth-callback` carrying a PKCE `?code=…`, which we exchange for a
 * session on this device (the matching code verifier was stored locally when the flow was started).
 * On success the auth state change drives routing; on failure we fall back to the login screen.
 * The web target has its own sibling (`use-auth-deeplink.web.ts`): a browser tab lets supabase-js
 * parse the URL, while the Tauri shell receives the same `nox://` link over the deep-link plugin.
 * Mount once at the root, inside the navigation tree.
 */
export function useAuthDeepLink(): void {
  const { exchangeCodeForSession } = useAuth();

  useEffect(() => {
    let cancelled = false;
    // A cold-start link can arrive via both getInitialURL and the listener; exchange each code once
    // (a spent code would throw and wrongly bounce an already-authed user to login).
    const seen = new Set<string>();

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);

      // A REJECTED link carries no code at all — Supabase puts `error`/`error_code` in the
      // fragment, which Linking.parse drops entirely. Without this branch an expired or
      // already-used link routed to /auth-callback and span there forever, because the screen had
      // nothing to tell it the link had failed. Forward the machine-readable code as a route param
      // so it can render "This link didn't work" and offer a way back.
      const fragment = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
      const frag = new URLSearchParams(fragment);
      const error = frag.get("error") ?? asString(parsed.queryParams?.error);
      const errorCode = frag.get("error_code") ?? asString(parsed.queryParams?.error_code);
      if (error || errorCode) {
        if (!cancelled) {
          router.replace(`/auth-callback?error_code=${encodeURIComponent(errorCode ?? "unknown")}`);
        }
        return;
      }

      const code = parsed.queryParams?.code;
      if (typeof code !== "string" || !code || seen.has(code)) return;
      seen.add(code);
      try {
        await exchangeCodeForSession(code);
        // Success: onAuthStateChange sets the session (or the recovery flag); the gate routes onward.
      } catch (e) {
        // Error screen, not login — see the web sibling: replacing with login is invisible to a
        // signed-out user and leaves no trace of why the link did nothing.
        console.warn("[auth] deep-link code exchange failed:", e);
        if (!cancelled) router.replace("/auth-callback?error_code=exchange_failed");
      }
    };

    // Cold start: a link may have launched the app (or be the current web URL).
    Linking.getInitialURL().then((url) => {
      if (!cancelled) void handleUrl(url);
    });
    // Warm: links arriving while the app is already running.
    const sub = Linking.addEventListener("url", ({ url }) => void handleUrl(url));

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [exchangeCodeForSession]);
}
