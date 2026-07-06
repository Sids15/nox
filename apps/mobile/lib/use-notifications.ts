import { usePrefs, useTasks } from "@nox/features";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import {
  cancelAllNotifications,
  configureNotifications,
  ensurePermission,
  reconcileTaskReminders,
  setDailyNudge,
  taskIdFromResponse,
} from "./notifications";

// Remembers the last cold-start notification response we deep-linked from, so a normal relaunch
// doesn't re-open it (getLastNotificationResponseAsync persists the last tap across launches).
const LAST_HANDLED_KEY = "nox:notif:lastHandledId";

/**
 * Drives local notifications from app state: schedules task reminders to match the current tasks,
 * keeps the two daily nudges in sync with their toggles, and deep-links to a task when its reminder
 * is tapped. Mount once, inside the authed tree (it reads the tasks query).
 */
export function useNotifications() {
  const router = useRouter();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const taskReminders = usePrefs((s) => s.taskReminders);
  const morningSummary = usePrefs((s) => s.morningSummary);
  const endOfDayPrompt = usePrefs((s) => s.endOfDayPrompt);

  // Configure once, and route on tap. Live taps (running/background) always navigate. A cold-start
  // response only navigates if we haven't handled it before — getLastNotificationResponseAsync
  // persists the last tap across launches, so without this guard a normal launch re-opens a stale task.
  useEffect(() => {
    configureNotifications();
    const openFromResponse = (response: Notifications.NotificationResponse | null) => {
      const taskId = response && taskIdFromResponse(response);
      if (taskId) router.push(`/task/${taskId}`);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    void Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      const handled = await AsyncStorage.getItem(LAST_HANDLED_KEY).catch(() => null);
      if (handled === id) return; // already deep-linked from this tap on a previous launch
      await AsyncStorage.setItem(LAST_HANDLED_KEY, id).catch(() => {});
      openFromResponse(response);
    });
    return () => sub.remove();
  }, [router]);

  // Default-on reminders/nudges still need OS permission. The Settings toggles only prompt on a
  // manual enable, so request once at startup if anything is already on (e.g. a fresh install where
  // the summaries default on) — otherwise the prompt never appears and they silently never deliver.
  useEffect(() => {
    if (taskReminders || morningSummary || endOfDayPrompt) void ensurePermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep task reminders reconciled with the tasks (or cleared when the toggle is off). Wait for the
  // first load: reconciling against the initial empty list would cancel every scheduled reminder
  // before the query resolves, losing them if the app is killed in that window.
  useEffect(() => {
    if (tasksLoading) return;
    reconcileTaskReminders(taskReminders ? tasks : []);
  }, [tasks, taskReminders, tasksLoading]);

  // Daily nudges follow their toggles.
  useEffect(() => {
    setDailyNudge("morning", morningSummary);
  }, [morningSummary]);
  useEffect(() => {
    setDailyNudge("endOfDay", endOfDayPrompt);
  }, [endOfDayPrompt]);

  // On sign-out this bridge unmounts — clear every scheduled notification so one user's reminders
  // (which carry their task titles) never keep firing for the next user on a shared device.
  useEffect(() => {
    return () => {
      void cancelAllNotifications();
    };
  }, []);
}
