import * as Linking from "expo-linking";

/** The app's deep link, the same one the desktop app uses. Already in the Supabase allow-list. */
const APP_REDIRECT = "nox://auth-callback";

/**
 * Where confirmation / reset links return to on native: the app's `nox://auth-callback` deep link,
 * which `useAuthDeepLink` exchanges the PKCE code from.
 *
 * Spelled out rather than built with `Linking.createURL`, which in an installed app gives
 * `nox:///auth-callback` (three slashes). That doesn't match the allow-list entry, and Supabase
 * then quietly sends the link to its Site URL (localhost) instead. In development (Expo Go has no
 * `nox://` scheme) `createURL` gives the `exp://` address the dev client needs.
 */
export function authRedirect(): string {
  return __DEV__ ? Linking.createURL("/auth-callback") : APP_REDIRECT;
}
