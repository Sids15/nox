import { usePrefs, useTasks } from "@nox/features";
import { useEffect } from "react";

import { planDailyNudges, planTaskReminders } from "./notification-plan";
import { clearSchedule, ensurePermission, pushSchedule, type ScheduledItem } from "./desktop-notify";

/**
 * Desktop notification driver. Computes the desired schedule (reusing the same pure planners the
 * native build uses) and hands it to the Rust scheduler, re-sending whenever tasks or toggles change
 * and on a 5-minute heartbeat so the daily nudges roll forward. On sign-out (unmount) it clears the
 * schedule. Mount once, inside the authed tree (it reads the tasks query). No-ops in a plain browser
 * (the bridge guards on isTauri). Mirrors `use-notifications.ts`.
 */
export function useNotifications(): void {
  const { data: tasks = [], isLoading } = useTasks();
  const taskReminders = usePrefs((s) => s.taskReminders);
  const morningSummary = usePrefs((s) => s.morningSummary);
  const endOfDayPrompt = usePrefs((s) => s.endOfDayPrompt);

  // Request permission once if anything is already on (defaults have the summaries on), so a fresh
  // install prompts rather than silently never delivering.
  useEffect(() => {
    if (taskReminders || morningSummary || endOfDayPrompt) void ensurePermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build + push the schedule. Wait for the first tasks load so we don't push an empty task set that
  // would cancel reminders before the query resolves.
  useEffect(() => {
    if (isLoading) return;

    const build = (): ScheduledItem[] => {
      const now = Date.now();
      const items: ScheduledItem[] = [];
      if (taskReminders) {
        for (const r of planTaskReminders(tasks, now)) {
          items.push({ id: r.id, fireAtMs: r.date.getTime(), title: r.title, body: "Reminder", taskId: r.taskId });
        }
      }
      for (const n of planDailyNudges(now, { morning: morningSummary, endOfDay: endOfDayPrompt })) {
        items.push({ id: n.id, fireAtMs: n.date.getTime(), title: n.title, body: n.body, taskId: null });
      }
      return items;
    };

    void pushSchedule(build());
    const heartbeat = setInterval(() => void pushSchedule(build()), 5 * 60_000);
    return () => clearInterval(heartbeat);
  }, [tasks, taskReminders, morningSummary, endOfDayPrompt, isLoading]);

  // Clear every scheduled reminder on sign-out (this bridge unmounts) — one user's reminders carry
  // their task titles and must not keep firing for the next user on a shared device.
  useEffect(() => {
    return () => {
      void clearSchedule();
    };
  }, []);
}
