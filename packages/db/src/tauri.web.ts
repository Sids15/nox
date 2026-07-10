/**
 * True only inside the Tauri desktop shell, not in a plain browser tab. Tauri injects
 * `__TAURI_INTERNALS__` into every window it hosts, regardless of `withGlobalTauri` (that flag only
 * controls the `window.__TAURI__` convenience API). We check for it rather than sniffing the origin,
 * because the origin differs across platforms — `tauri://localhost` on macOS, `http://tauri.localhost`
 * on Windows.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
