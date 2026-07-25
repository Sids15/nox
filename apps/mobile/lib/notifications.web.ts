/**
 * Web face of the notification module (the `.web` sibling of `notifications.ts`). Settings imports
 * `ensurePermission` from `./notifications`; on web that's the desktop/Tauri permission request. The
 * scheduler itself lives in `desktop-notify.ts` and is driven by `use-notifications.web.ts`.
 */
export { ensurePermission, sendTestNotification } from "./desktop-notify";

/** Parity no-op with the native module's shape. */
export async function configureNotifications(): Promise<void> {}
