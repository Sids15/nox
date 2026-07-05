import type { Task } from "@nox/types";

/**
 * Pure scheduling logic for task-reminder notifications — no native/Expo imports, so it can be unit
 * tested. `notifications.ts` wraps these with the actual expo-notifications calls.
 */

export const TASK_PREFIX = "task:";
// iOS keeps at most 64 pending notifications; stay well under so daily nudges + headroom survive.
export const MAX_TASK_REMINDERS = 50;

export const taskReminderId = (taskId: string, iso: string) => `${TASK_PREFIX}${taskId}:${iso}`;

export interface PlannedReminder {
  id: string;
  date: Date;
  title: string;
  taskId: string;
}

/**
 * Which task reminders should be scheduled right now: every future `reminder_times` entry on each
 * non-complete task, soonest first, capped to the platform limit. Deterministic ids make the whole
 * thing idempotent to re-run.
 */
export function planTaskReminders(tasks: Task[], now: number, cap = MAX_TASK_REMINDERS): PlannedReminder[] {
  return tasks
    .filter((t) => t.status !== "complete")
    .flatMap((t) =>
      t.reminder_times
        .filter((iso) => new Date(iso).getTime() > now)
        .map((iso) => ({ id: taskReminderId(t.id, iso), date: new Date(iso), title: t.title, taskId: t.id })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, cap);
}

export interface ScheduleDiff {
  /** Existing task-reminder identifiers to cancel (no longer wanted). */
  toCancel: string[];
  /** Planned reminders not yet scheduled. */
  toSchedule: PlannedReminder[];
}

/** Diff the desired reminders against the already-scheduled identifiers. Only touches `task:` ids. */
export function diffTaskReminders(desired: PlannedReminder[], existingIds: string[]): ScheduleDiff {
  const desiredIds = new Set(desired.map((d) => d.id));
  const existing = existingIds.filter((id) => id.startsWith(TASK_PREFIX));
  const existingSet = new Set(existing);
  return {
    toCancel: existing.filter((id) => !desiredIds.has(id)),
    toSchedule: desired.filter((d) => !existingSet.has(d.id)),
  };
}
