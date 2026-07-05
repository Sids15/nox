import type { Task } from "@nox/types";

/**
 * Web no-op for the notification service. Local scheduling isn't available in the browser, so every
 * entry point is inert here — this keeps expo-notifications / expo-device out of the web bundle while
 * matching the native module's shape so callers don't change. `notification-plan.ts` (pure) is shared.
 */
export type DailyKind = "morning" | "endOfDay";

export async function configureNotifications(): Promise<void> {}

export async function ensurePermission(): Promise<boolean> {
  return false;
}

export async function reconcileTaskReminders(_tasks: Task[]): Promise<void> {}

export async function setDailyNudge(_kind: DailyKind, _on: boolean): Promise<void> {}

export function taskIdFromResponse(_response: unknown): string | null {
  return null;
}
