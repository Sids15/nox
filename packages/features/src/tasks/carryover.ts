import type { Task } from "@nox/types";

/**
 * Ids of standalone (non-recurring, non-occurrence) tasks that are still open and due before `today`.
 * These get moved to today as `carried_over`. Recurring occurrences are intentionally excluded —
 * recurring tasks "repeat fresh" via generate-on-demand rather than piling up as overdue.
 */
export function carryoverTaskIds(tasks: Task[], today: string): string[] {
  return tasks
    .filter(
      (t) =>
        t.repeat === "none" &&
        t.origin_task_id === null &&
        t.status !== "complete" &&
        t.due_date !== null &&
        t.due_date < today,
    )
    .map((t) => t.id);
}
