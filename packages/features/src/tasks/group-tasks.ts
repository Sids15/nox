import { isOverdue, todayKey } from "@nox/utils";
import type { Task } from "@nox/types";

export interface GroupedTasks {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  completed: Task[];
}

/** Stable in-group ordering: manual sort_order, then earliest time (undated last), then age. */
function byDisplayOrder(a: Task, b: Task): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  const at = a.due_time ?? "￿"; // nulls sort last
  const bt = b.due_time ?? "￿";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/**
 * Split live tasks into the sections the Tasks screen renders. Pure and timezone-local:
 * `today` defaults to the device's calendar day. A no-due-date task is treated as a
 * "personal-now" item and lands in Today. Completed tasks are grouped regardless of date.
 * These rules are intentionally simple and easy to tune when the UI design lands.
 */
export function groupTasks(tasks: Task[], today: string = todayKey()): GroupedTasks {
  const groups: GroupedTasks = { overdue: [], today: [], upcoming: [], completed: [] };

  for (const t of tasks) {
    if (t.status === "complete") {
      groups.completed.push(t);
    } else if (t.due_date === null || t.due_date === today) {
      groups.today.push(t);
    } else if (isOverdue(t.due_date, today)) {
      groups.overdue.push(t);
    } else {
      groups.upcoming.push(t);
    }
  }

  groups.overdue.sort(byDisplayOrder);
  groups.today.sort(byDisplayOrder);
  groups.upcoming.sort(byDisplayOrder);
  groups.completed.sort(byDisplayOrder);
  return groups;
}
