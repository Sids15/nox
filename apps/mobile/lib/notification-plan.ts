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

/** The two repeating daily nudges and the wall-clock time each fires at. */
export const DAILY_NUDGES = {
  morning: { hour: 8, minute: 0, title: "Good morning", body: "Plan your day in Nox." },
  endOfDay: { hour: 21, minute: 0, title: "Wind down", body: "Set up tomorrow in Nox." },
} as const;
export type DailyKind = keyof typeof DAILY_NUDGES;
export const DAILY_PREFIX = "daily:";

/** `daily:morning:2026-07-24` — deterministic so re-sending the same day's nudge dedupes. */
function dailyId(kind: DailyKind, at: Date): string {
  const y = at.getFullYear();
  const m = `${at.getMonth() + 1}`.padStart(2, "0");
  const d = `${at.getDate()}`.padStart(2, "0");
  return `${DAILY_PREFIX}${kind}:${y}-${m}-${d}`;
}

export interface PlannedNudge {
  id: string;
  date: Date;
  title: string;
  body: string;
}

/**
 * The next occurrence of each enabled daily nudge. If today's time has already passed, rolls to
 * tomorrow — so the id is always tomorrow's date in that case, and today's (already fired) nudge is
 * never re-scheduled. Only enabled kinds are returned. Pure: `now` is injected for testing.
 */
export function planDailyNudges(
  now: number,
  flags: { morning: boolean; endOfDay: boolean },
): PlannedNudge[] {
  const out: PlannedNudge[] = [];
  for (const kind of ["morning", "endOfDay"] as const) {
    if (!flags[kind]) continue;
    const { hour, minute, title, body } = DAILY_NUDGES[kind];
    const at = new Date(now);
    at.setHours(hour, minute, 0, 0);
    if (at.getTime() <= now) at.setDate(at.getDate() + 1);
    out.push({ id: dailyId(kind, at), date: at, title, body });
  }
  return out;
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
