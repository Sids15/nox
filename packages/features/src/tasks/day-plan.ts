import type { Task } from "@nox/types";
import { occursOn } from "./recurrence";

export interface PlannedTask {
  task: Task;
  /** A repeating task expected on this day whose occurrence hasn't been created yet (shown, not stored). */
  projected: boolean;
}

const isTemplate = (t: Task) => t.repeat !== "none" && t.origin_task_id === null;

/**
 * Everything on `day`: tasks dated that day, undated tasks when `day` is today, and repeating tasks
 * whose rule includes the day but whose occurrence isn't materialized yet (future days in a calendar
 * or a preview) — unless it was deleted (`skipped`, from useSkippedOccurrences). Completed tasks are included; callers decide how to show them. Sorted by time
 * (untimed last), then by sort order.
 */
export function tasksOnDay(tasks: Task[], day: string, today: string, skipped?: Set<string>): PlannedTask[] {
  const out: PlannedTask[] = [];
  const materialized = new Set<string>();
  for (const t of tasks) {
    // A deleted occurrence still claims its day: the user removed that one, so don't project it back.
    if (t.deleted) {
      if (t.origin_task_id && t.due_date === day) materialized.add(t.origin_task_id);
      continue;
    }
    if (t.due_date === day || (t.due_date === null && day === today)) {
      out.push({ task: t, projected: false });
      if (t.origin_task_id) materialized.add(t.origin_task_id);
    }
  }
  for (const t of tasks) {
    if (t.deleted || !isTemplate(t) || t.due_date === day || materialized.has(t.id)) continue;
    if (skipped?.has(`${t.id}:${day}`)) continue; // that day's occurrence was deleted
    if (day >= today && occursOn(t, day)) out.push({ task: t, projected: true });
  }
  return out.sort(
    (a, b) =>
      (a.task.due_time ?? "99").localeCompare(b.task.due_time ?? "99") ||
      a.task.sort_order - b.task.sort_order ||
      a.task.created_at.localeCompare(b.task.created_at),
  );
}

/** "HH:MM[:SS]" → minutes after midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + (m || 0);
}

/** Minutes after midnight → "HH:MM". */
export function minutesToTime(min: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const length = (t: Task) => t.duration_minutes || 30;

/** Busy stretches of a day, in minutes after midnight, from its open timed tasks. */
function busyOf(planned: PlannedTask[]): [number, number][] {
  return planned
    .filter((p) => p.task.status !== "complete" && p.task.due_time)
    .map((p) => {
      const s = timeToMinutes(p.task.due_time!);
      return [s, s + length(p.task)] as [number, number];
    });
}

export interface SlotOptions {
  /** First and last minute of the working day (e.g. 7 × 60, 22 × 60). */
  dayStart: number;
  dayEnd: number;
  /** Nothing earlier than this minute (now, on today). */
  notBefore?: number;
  /** Granularity of start times, in minutes. */
  step?: number;
}

/**
 * The earliest start ("HH:MM") on a day with `minutes` free between existing timed tasks, inside the
 * working hours and not before `notBefore`; null when the day is full.
 */
export function findFreeSlot(planned: PlannedTask[], minutes: number, opts: SlotOptions): string | null {
  return firstFree(busyOf(planned), minutes, opts);
}

function firstFree(busy: [number, number][], minutes: number, { dayStart, dayEnd, notBefore = 0, step = 15 }: SlotOptions): string | null {
  let t = Math.ceil(Math.max(dayStart, notBefore) / step) * step;
  for (; t + minutes <= dayEnd; t += step) {
    const end = t + minutes;
    if (!busy.some(([s, e]) => t < e && end > s)) return minutesToTime(t);
  }
  return null;
}

const PRIORITY_ORDER: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

/**
 * Fit a day's untimed tasks into its free time: highest priority first (then their list order), each
 * at the earliest gap long enough for it, around what's already scheduled. Returns where each one
 * goes; tasks that don't fit are left out (they stay "anytime").
 */
export function autoSchedule(planned: PlannedTask[], toPlace: Task[], opts: SlotOptions): { id: string; time: string }[] {
  const busy = busyOf(planned);
  const ordered = [...toPlace].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.sort_order - b.sort_order);
  const out: { id: string; time: string }[] = [];
  for (const t of ordered) {
    const at = firstFree(busy, length(t), opts);
    if (!at) continue;
    const s = timeToMinutes(at);
    busy.push([s, s + length(t)]);
    out.push({ id: t.id, time: at });
  }
  return out;
}
