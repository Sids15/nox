import * as Linking from "expo-linking";

/**
 * Where confirmation / reset links return to. On native this is the app's `nox://auth-callback`
 * deep link, which `useAuthDeepLink` exchanges the PKCE code from.
 */
export function authRedirect(): string {
  return Linking.createURL("/auth-callback");
}
