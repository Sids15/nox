import { AuthRepository } from "@nox/api";
import type { OAuthProvider } from "@nox/types";
import * as WebBrowser from "expo-web-browser";

import { authRedirect } from "./auth-redirect";

/**
 * Social sign-in on NATIVE.
 *
 * The consent page opens in `openAuthSessionAsync` — the OS's own auth browser (SFAuthenticationSession
 * / Custom Tabs), not a plain WebView. That matters twice over: the user gets a real address bar to
 * verify the provider's domain before typing a password, and Google rejects OAuth from embedded
 * webviews outright. It also returns control to us when the redirect fires, so we can exchange the
 * code here instead of racing the deep-link listener.
 *
 * Returns false when the user backed out (dismiss / cancel), which is not an error and must not
 * surface as one.
 */
export async function startOAuth(provider: OAuthProvider): Promise<boolean> {
  const redirectTo = authRedirect();
  const url = await AuthRepository.signInWithOAuth(provider, redirectTo, true);
  if (!url) throw new Error("Could not start sign-in. Please try again.");

  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (result.type !== "success") return false;

  const code = new URL(result.url).searchParams.get("code");
  if (!code) {
    // The provider redirected without a code — usually a denied consent screen.
    throw new Error("Sign-in was not completed.");
  }
  await AuthRepository.exchangeCodeForSession(code);
  return true;
}
