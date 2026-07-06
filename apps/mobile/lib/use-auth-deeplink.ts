import { useAuth } from "@nox/features";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Handles auth redirect links — email confirmation, password reset (and, later, OAuth). Every link
 * returns to `/auth-callback` carrying a PKCE `?code=…`, which we exchange for a session on this
 * device (the matching code verifier was stored locally when the flow was started). On success the
 * auth state change drives routing; on failure we fall back to the login screen. Mount once at the
 * root, inside the navigation tree.
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
      const code = Linking.parse(url).queryParams?.code;
      if (typeof code !== "string" || !code || seen.has(code)) return;
      seen.add(code);
      try {
        await exchangeCodeForSession(code);
        // Success: onAuthStateChange sets the session (or the recovery flag); the gate routes onward.
      } catch {
        if (!cancelled) router.replace("/(auth)/login");
      } finally {
        clearCodeFromUrl();
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

/** Drop the spent `?code=` from the web URL so a refresh can't try to re-exchange it. */
function clearCodeFromUrl(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.has("code")) {
    url.searchParams.delete("code");
    window.history.replaceState({}, "", url.toString());
  }
}
