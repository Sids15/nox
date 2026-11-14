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
