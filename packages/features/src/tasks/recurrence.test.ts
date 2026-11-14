import { describe, expect, test } from "bun:test";
import type { Task } from "@nox/types";
import { nextOccurrenceDate, occursOn, shiftReminders, templatesNeedingOccurrence } from "./recurrence";

// Anchor 2026-07-06 is a Monday. That week: Mon 06, Tue 07, Wed 08, Thu 09, Fri 10, Sat 11, Sun 12.
const MON = "2026-07-06";

const base: Task = {
  id: "tmpl",
  user_id: "u",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  deleted: false,
  title: "x",
  notes: null,
  due_date: MON,
  due_time: null,
  reminder_times: [],
  priority: "medium",
  status: "pending",
  repeat: "none",
  repeat_config: null,
  origin_task_id: null,
  sort_order: 0,
  streak_count: 0,
  longest_streak: 0,
  last_completed_on: null,
};
const mk = (o: Partial<Task>): Task => ({ ...base, ...o });

describe("occursOn", () => {
  test("never before the anchor", () => {
    expect(occursOn(mk({ repeat: "daily" }), "2026-07-05")).toBe(false);
  });

  test("daily occurs on/after the anchor", () => {
    expect(occursOn(mk({ repeat: "daily" }), MON)).toBe(true);
    expect(occursOn(mk({ repeat: "daily" }), "2026-07-09")).toBe(true);
  });

  test("weekdays = Mon–Fri only", () => {
    expect(occursOn(mk({ repeat: "weekdays" }), "2026-07-10")).toBe(true); // Fri
    expect(occursOn(mk({ repeat: "weekdays" }), "2026-07-11")).toBe(false); // Sat
    expect(occursOn(mk({ repeat: "weekdays" }), "2026-07-12")).toBe(false); // Sun
  });

  test("weekly = the anchor's weekday", () => {
    expect(occursOn(mk({ repeat: "weekly" }), "2026-07-13")).toBe(true); // next Mon
    expect(occursOn(mk({ repeat: "weekly" }), "2026-07-08")).toBe(false); // Wed
  });

  test("custom weekdays list", () => {
    const t = mk({ repeat: "custom", repeat_config: { weekdays: [1, 3] } }); // Mon, Wed
    expect(occursOn(t, "2026-07-08")).toBe(true); // Wed
    expect(occursOn(t, "2026-07-07")).toBe(false); // Tue
  });

  test("custom interval skips weeks", () => {
    const t = mk({ repeat: "custom", repeat_config: { weekdays: [1], interval: 2 } });
    expect(occursOn(t, "2026-07-13")).toBe(false); // +1 week
    expect(occursOn(t, "2026-07-20")).toBe(true); // +2 weeks
  });
});

describe("templatesNeedingOccurrence", () => {
  test("returns a template with no occurrence on a future matching date", () => {
    const tmpl = mk({ id: "d", repeat: "daily" });
    expect(templatesNeedingOccurrence([tmpl], "2026-07-09").map((t) => t.id)).toEqual(["d"]);
  });

  test("excludes the anchor day itself (template already shows there)", () => {
    const tmpl = mk({ id: "d", repeat: "daily" });
    expect(templatesNeedingOccurrence([tmpl], MON)).toEqual([]);
  });

  test("skips a template that already has an occurrence for the date", () => {
    const tmpl = mk({ id: "d", repeat: "daily" });
    const occ = mk({ id: "occ", origin_task_id: "d", due_date: "2026-07-09", repeat: "none" });
    expect(templatesNeedingOccurrence([tmpl, occ], "2026-07-09")).toEqual([]);
  });

  test("ignores non-templates and non-matching dates", () => {
    const plain = mk({ id: "p", repeat: "none" });
    const weekly = mk({ id: "w", repeat: "weekly" });
    expect(templatesNeedingOccurrence([plain, weekly], "2026-07-08")).toEqual([]); // Wed ≠ Mon
  });
});

describe("shiftReminders", () => {
  test("moves each reminder by the day gap, keeping the local wall-clock time", () => {
    const at = new Date(2026, 6, 6, 9, 30).toISOString(); // Mon 06, 9:30 local
    const [shifted] = shiftReminders([at], MON, "2026-07-09");
    const d = new Date(shifted!);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 6, 9, 9, 30]);
  });

  test("is a no-op for the same day", () => {
    const times = ["2026-07-06T09:30:00.000Z"];
    expect(shiftReminders(times, MON, MON)).toBe(times);
  });
});

describe("nextOccurrenceDate", () => {
  test("daily → the next day", () => {
    expect(nextOccurrenceDate(mk({ repeat: "daily" }), [])).toBe("2026-07-07");
  });

  test("weekdays skips the weekend from a Friday anchor", () => {
    expect(nextOccurrenceDate(mk({ repeat: "weekdays", due_date: "2026-07-10" }), [])).toBe("2026-07-13");
  });

  test("custom follows the configured weekdays", () => {
    const t = mk({ repeat: "custom", repeat_config: { weekdays: [1, 4] } }); // Mon + Thu
    expect(nextOccurrenceDate(t, [])).toBe("2026-07-09");
  });

  test("skips days that already have an occurrence, so the task never shows twice", () => {
    const t = mk({ repeat: "daily" });
    const tue = mk({ id: "o1", origin_task_id: "tmpl", due_date: "2026-07-07" });
    const wed = mk({ id: "o2", origin_task_id: "tmpl", due_date: "2026-07-08" });
    expect(nextOccurrenceDate(t, [t, tue, wed])).toBe("2026-07-09");
  });

  test("null for anything that is not a dated template", () => {
    expect(nextOccurrenceDate(mk({ repeat: "none" }), [])).toBeNull();
    expect(nextOccurrenceDate(mk({ repeat: "daily", due_date: null }), [])).toBeNull();
    expect(nextOccurrenceDate(mk({ repeat: "daily", origin_task_id: "other" }), [])).toBeNull();
  });
});
