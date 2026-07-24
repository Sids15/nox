import { Linking } from "react-native";

/**
 * Resolve a user-supplied value to a safe absolute URL, or null.
 *
 * Resource/link URLs are arbitrary user input, so a value could carry a dangerous scheme —
 * `javascript:`, `file:`, `data:`, a custom app scheme. Only ever return http/https; everything else
 * is refused. (The Tauri opener capability enforces this too, but native `Linking.openURL` and a
 * plain browser `window.open` do not, so the guard lives here.)
 */
export function toHttpUrl(url: string): string | null {
  const s = url.trim();
  if (!s) return null;
  const candidate = s.includes("://") ? s : `https://${s}`;
  try {
    const u = new URL(candidate);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Open a URL in the user's browser. Native uses the OS handler. Non-http(s) values are ignored. */
export async function openExternal(url: string): Promise<void> {
  const target = toHttpUrl(url);
  if (target) await Linking.openURL(target);
}
