import { isTauri } from "@nox/db";
import { openUrl } from "@tauri-apps/plugin-opener";

/** Normalises a bare domain to an absolute https URL so `example.com` opens instead of failing. */
function normalize(url: string): string {
  return /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Open a URL in the user's browser.
 *
 * In the Tauri shell a plain `window.open` / `Linking.openURL` is swallowed by the webview — the
 * link either does nothing or tries to navigate the app itself. The opener plugin hands the URL to
 * the OS default browser instead (the same path OAuth already uses). A normal browser tab just uses
 * `window.open`; `noopener,noreferrer` so the opened page can't reach back through `window.opener`.
 */
export async function openExternal(url: string): Promise<void> {
  const target = normalize(url);
  if (isTauri()) {
    await openUrl(target);
  } else {
    window.open(target, "_blank", "noopener,noreferrer");
  }
}
