import type { Task } from "@nox/types";
import { dayOfWeek } from "@nox/utils";

/** Days between two YYYY-MM-DD keys (b − a), local midnights. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86_400_000,
  );
}

/**
 * Whether a repeating template's rule includes `dateKey` (on or after its anchor `due_date`).
 * daily = every day · weekdays = Mon–Fri · weekly = the anchor's weekday · custom =
 * `repeat_config.weekdays` (falling back to the anchor's weekday), optionally every `interval` weeks.
 */
export function occursOn(template: Task, dateKey: string): boolean {
  const anchor = template.due_date;
  if (anchor === null || dateKey < anchor) return false;

  const dow = dayOfWeek(dateKey);
  switch (template.repeat) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekly":
      return dow === dayOfWeek(anchor);
    case "custom": {
      const days = template.repeat_config?.weekdays;
      if (days && days.length > 0) {
        if (!days.includes(dow)) return false;
      } else if (dow !== dayOfWeek(anchor)) {
        return false; // no weekdays configured → behave like weekly on the anchor's weekday
      }
      const interval = template.repeat_config?.interval ?? 1;
      if (interval > 1 && Math.floor(daysBetween(anchor, dateKey) / 7) % interval !== 0) {
        return false;
      }
      return true;
    }
    default:
      return false; // "none" is not a template
  }
}

/**
 * Templates that should have an occurrence materialized on `focusDate` but don't yet. A template is a
 * live task with `repeat != none` and no `origin_task_id`. We only generate for dates strictly after
 * the anchor — the anchor day shows the template itself.
 */
export function templatesNeedingOccurrence(tasks: Task[], focusDate: string): Task[] {
  const withOccurrence = new Set(
    tasks
      .filter((t) => t.origin_task_id !== null && t.due_date === focusDate)
      .map((t) => t.origin_task_id),
  );

  return tasks.filter(
    (t) =>
      t.repeat !== "none" &&
      t.origin_task_id === null &&
      t.due_date !== null &&
      focusDate > t.due_date &&
      occursOn(t, focusDate) &&
      !withOccurrence.has(t.id),
  );
}
