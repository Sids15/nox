import { Platform } from "react-native";
import { bookmarkletBase } from "./bookmarklet";

/**
 * The public address of the Nox web app, for links meant to be opened in any browser (share links,
 * the bookmarklet): EXPO_PUBLIC_WEB_URL if set, else — in a browser tab — the address Nox is open at.
 * Null in the phone and desktop apps when it isn't configured.
 */
export function webBase(): string | null {
  const origin =
    Platform.OS === "web" && typeof window !== "undefined" && /^https?:$/.test(window.location.protocol) ? window.location.origin : null;
  return bookmarkletBase(process.env.EXPO_PUBLIC_WEB_URL, origin);
}
