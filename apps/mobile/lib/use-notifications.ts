import { usePrefs, useTasks } from "@nox/features";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import {
  configureNotifications,
  reconcileTaskReminders,
  setDailyNudge,
  taskIdFromResponse,
} from "./notifications";

/**
 * Drives local notifications from app state: schedules task reminders to match the current tasks,
 * keeps the two daily nudges in sync with their toggles, and deep-links to a task when its reminder
 * is tapped. Mount once, inside the authed tree (it reads the tasks query).
 */
export function useNotifications() {
  const router = useRouter();
  const { data: tasks = [] } = useTasks();
  const taskReminders = usePrefs((s) => s.taskReminders);
  const morningSummary = usePrefs((s) => s.morningSummary);
  const endOfDayPrompt = usePrefs((s) => s.endOfDayPrompt);

  // Configure once, and route on tap (both while running and from a cold start).
  useEffect(() => {
    configureNotifications();
    const openFromResponse = (response: Notifications.NotificationResponse | null) => {
      const taskId = response && taskIdFromResponse(response);
      if (taskId) router.push(`/task/${taskId}`);
    };
    Notifications.getLastNotificationResponseAsync().then(openFromResponse);
    const sub = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => sub.remove();
  }, [router]);

  // Keep task reminders reconciled with the tasks (or cleared when the toggle is off).
  useEffect(() => {
    reconcileTaskReminders(taskReminders ? tasks : []);
  }, [tasks, taskReminders]);

  // Daily nudges follow their toggles.
  useEffect(() => {
    setDailyNudge("morning", morningSummary);
  }, [morningSummary]);
  useEffect(() => {
    setDailyNudge("endOfDay", endOfDayPrompt);
  }, [endOfDayPrompt]);
}
