import * as Notifications from "expo-notifications";

const ID = "focus:end";

/**
 * Phones: one local notification when the focus timer ends, so it still tells you with the app in the
 * background. Rescheduled on every start/resume, cancelled on pause or stop. Best-effort.
 */
export async function setFocusAlert(at: number | null, body: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(ID);
    if (at === null || at <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: { title: "Focus done", body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
  } catch {
    /* notifications unsupported on this runtime */
  }
}
