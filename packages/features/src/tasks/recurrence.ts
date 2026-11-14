import type { Task } from "@nox/types";
import { addDays, dayOfWeek } from "@nox/utils";

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

/**
 * A template's reminders, moved from its anchor day to `toDate` at the same wall-clock time.
 * `reminder_times` are absolute timestamps on the anchor day, so copied verbatim onto a later
 * occurrence they are already in the past and never fire. Shifted in local time (setDate), so a
 * 9:00 reminder stays 9:00 across a DST change.
 */
export function shiftReminders(times: string[], fromDate: string, toDate: string): string[] {
  const days = daysBetween(fromDate, toDate);
  if (days === 0) return times;
  return times.map((iso) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  });
}

/** How far ahead to look for a template's next day. Covers any weekly rule with room to spare. */
const NEXT_OCCURRENCE_HORIZON_DAYS = 366;

/**
 * The next day after a template's anchor that its rule includes and that has no occurrence row yet —
 * where the anchor moves to when the user deletes only the anchor day. Days that already have an
 * occurrence are skipped: moving the anchor onto one would show the task twice that day. Null when
 * the task isn't a dated template or nothing falls inside the horizon.
 */
export function nextOccurrenceDate(template: Task, tasks: Task[]): string | null {
  const anchor = template.due_date;
  if (anchor === null || template.repeat === "none" || template.origin_task_id !== null) return null;

  const taken = new Set(
    tasks.filter((t) => t.origin_task_id === template.id && t.due_date !== null).map((t) => t.due_date),
  );
  for (let i = 1; i <= NEXT_OCCURRENCE_HORIZON_DAYS; i++) {
    const day = addDays(anchor, i);
    if (occursOn(template, day) && !taken.has(day)) return day;
  }
  return null;
}
