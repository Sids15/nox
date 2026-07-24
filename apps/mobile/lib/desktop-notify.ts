import { isTauri } from "@nox/db";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";

/**
 * Desktop (Tauri) notification bridge. Unlike native — where expo-notifications hands the schedule to
 * the OS — the desktop plugin only fires immediately, so we hand the whole desired schedule to a Rust
 * background thread (`set_notifications`) that fires each item at its time even while the window is
 * hidden in the tray. Plain browser tabs have no scheduler, so every entry point no-ops there.
 *
 * Lives in its own (non platform-split) module so `use-notifications.web.ts` can import these
 * desktop-only exports directly — `./notifications` resolves to the native module under tsc, which
 * has a different shape.
 */

export interface ScheduledItem {
  id: string;
  fireAtMs: number;
  title: string;
  body: string;
  taskId: string | null;
}

/** Ask the OS for notification permission (idempotent). Non-Tauri web can't schedule, so false. */
export async function ensurePermission(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Hand the full desired schedule to the Rust scheduler, replacing whatever it held. */
export async function pushSchedule(items: ScheduledItem[]): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("set_notifications", { items });
  } catch {
    /* best-effort — the scheduler is unavailable (e.g. a plain browser tab) */
  }
}

/** Drop the schedule — sign-out, so one user's task-titled reminders can't fire for the next. */
export async function clearSchedule(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("clear_notifications");
  } catch {
    /* best-effort */
  }
}
