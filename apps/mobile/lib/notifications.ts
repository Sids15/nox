import type { Task } from "@nox/types";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { diffTaskReminders, planTaskReminders } from "./notification-plan";

/**
 * Local notifications for Nox. Everything here is scheduled on-device from local data and never
 * transits a server, so — unlike remote push (rules.md: "notification payloads IDs-only") — it is
 * correct to put the task title in the notification body. The `data` payload still carries only the
 * task id, which the tap handler uses to deep-link.
 *
 * Note: SDK 53+ dropped notification support from Expo Go (Android) and limits it on iOS; these
 * calls no-op gracefully there and are meant to be verified in a development build.
 */

const DAILY_ID = { morning: "daily:morning", endOfDay: "daily:endOfDay" } as const;
export type DailyKind = keyof typeof DAILY_ID;

const DAILY_COPY: Record<DailyKind, { hour: number; minute: number; title: string; body: string }> = {
  morning: { hour: 8, minute: 0, title: "Good morning", body: "Plan your day in Nox." },
  endOfDay: { hour: 21, minute: 0, title: "Wind down", body: "Set up tomorrow in Nox." },
};

/** Foreground presentation + Android channel. Call once at startup. */
export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      /* unsupported (e.g. Expo Go) — ignore */
    }
  }
}

/** Request permission (device-only). Returns whether notifications are granted. Never throws. */
export async function ensurePermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/**
 * Make the scheduled task reminders match the current tasks (planning + diff in `notification-plan`).
 * Idempotent (deterministic identifiers) — safe to run on every task change. Pass an empty list to
 * clear them all (e.g. the toggle is off).
 */
export async function reconcileTaskReminders(tasks: Task[]): Promise<void> {
  try {
    const desired = planTaskReminders(tasks, Date.now());
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const { toCancel, toSchedule } = diffTaskReminders(desired, scheduled.map((n) => n.identifier));

    await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    await Promise.all(
      toSchedule.map((d) =>
        Notifications.scheduleNotificationAsync({
          identifier: d.id,
          content: { title: d.title, body: "Reminder", data: { taskId: d.taskId } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d.date },
        }),
      ),
    );
  } catch {
    /* best-effort — notifications unsupported on this runtime */
  }
}

/** Schedule (or cancel) one of the two repeating daily nudges. */
export async function setDailyNudge(kind: DailyKind, on: boolean): Promise<void> {
  const id = DAILY_ID[kind];
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
    if (!on) return;
    const { hour, minute, title, body } = DAILY_COPY[kind];
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Cancel every scheduled local notification. Called on sign-out (the notifications bridge unmounts):
 * one user's task reminders carry their task titles, so they must not keep firing for the next user
 * on a shared device.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* best-effort — notifications unsupported on this runtime */
  }
}

/** The task id a notification tap should open, if any. */
export function taskIdFromResponse(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data;
  const taskId = data?.taskId;
  return typeof taskId === "string" ? taskId : null;
}
