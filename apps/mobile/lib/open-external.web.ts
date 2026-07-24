import { isTauri } from "@nox/db";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Resolve a user-supplied value to a safe absolute URL, or null.
 *
 * Resource/link URLs are arbitrary user input, so a value could carry a dangerous scheme —
 * `javascript:`, `file:`, `data:`, a custom app scheme. Only ever return http/https; everything else
 * is refused before it can reach `window.open` (where `javascript:`/`data:` would be an XSS vector)
 * or the opener plugin.
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

/**
 * Open a URL in the user's browser.
 *
 * In the Tauri shell a plain `window.open` is swallowed by the webview, so the opener plugin hands
 * the URL to the OS browser (the path OAuth already uses). A normal tab uses `window.open` with
 * `noopener,noreferrer` so the opened page can't reach back through `window.opener`. Non-http(s)
 * values are ignored.
 */
export async function openExternal(url: string): Promise<void> {
  const target = toHttpUrl(url);
  if (!target) return;
  if (isTauri()) {
    await openUrl(target);
  } else {
    window.open(target, "_blank", "noopener,noreferrer");
  }
}
