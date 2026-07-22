import { AuthRepository } from "@nox/api";
import { isTauri } from "@nox/db";
import type { OAuthProvider } from "@nox/types";
import { openUrl } from "@tauri-apps/plugin-opener";

import { authRedirect } from "./auth-redirect";

/**
 * Social sign-in on the WEB target, which is two different environments.
 *
 * In a browser tab: let supabase-js navigate the page to the provider. The redirect comes back to
 * this origin's /auth-callback, `detectSessionInUrl` picks up the session, and this call never
 * returns because the document is replaced.
 *
 * In the Tauri shell: the consent page must NOT load in the app's webview — Google refuses OAuth
 * from embedded webviews, and a login form with no address bar is exactly what users are told to
 * distrust. So we hand the URL to the system browser and let the `nox://auth-callback` deep link
 * carry the code back to the running window, where `useAuthDeepLink` exchanges it. That means we
 * return with no session yet; the caller must not treat that as success.
 */
export async function startOAuth(provider: OAuthProvider): Promise<boolean> {
  const redirectTo = authRedirect();

  if (!isTauri()) {
    await AuthRepository.signInWithOAuth(provider, redirectTo, false);
    return true; // Unreachable in practice — the page has already navigated away.
  }

  const url = await AuthRepository.signInWithOAuth(provider, redirectTo, true);
  if (!url) throw new Error("Could not start sign-in. Please try again.");
  await openUrl(url);
  // Handed off to the browser. The deep link finishes the flow asynchronously.
  return false;
}
