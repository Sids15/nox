import { describe, expect, test } from "bun:test";
import type { FocusSession, Space, Task } from "@nox/types";
import { doneDay, insights, spaceLabel, weekReview } from "./stats";

const TODAY = "2026-11-28"; // a Saturday
/** Local noon on a day, as an ISO timestamp: the same calendar day in any time zone. */
const at = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12).toISOString();
};

let n = 0;
const task = (p: Partial<Task> = {}): Task => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  user_id: "u",
  created_at: at("2026-11-01"),
  updated_at: at("2026-11-01"),
  deleted: false,
  title: `task ${n}`,
  notes: null,
  due_date: null,
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
  space_id: null,
  inbox: false,
  ...p,
});
const done = (day: string, p: Partial<Task> = {}) => task({ status: "complete", completed_at: at(day), updated_at: at(day), ...p });
const session = (day: string, minutes: number, space_id: string | null = null): FocusSession => ({
  id: `s-${++n}`,
  user_id: "u",
  created_at: at(day),
  updated_at: at(day),
  deleted: false,
  task_id: null,
  space_id,
  started_at: at(day),
  minutes,
});

describe("doneDay", () => {
  test("uses completed_at, falls back to the last change, and is null while open", () => {
    expect(doneDay(done("2026-11-20"))).toBe("2026-11-20");
    expect(doneDay(task({ status: "complete", completed_at: null, updated_at: at("2026-11-19") }))).toBe("2026-11-19");
    expect(doneDay(task())).toBeNull();
  });
});

describe("weekReview", () => {
  test("done in the last 7 days (today included), newest first", () => {
    const r = weekReview([done("2026-11-21", { title: "old" }), done("2026-11-22", { title: "a" }), done("2026-11-28", { title: "b" })], [], TODAY);
    expect(r.from).toBe("2026-11-22");
    expect(r.done.map((t) => t.title)).toEqual(["b", "a"]);
  });

  test("slipped is open and past its day; upcoming is the next 7 days from tomorrow", () => {
    const r = weekReview(
      [
        task({ title: "late", due_date: "2026-11-25" }),
        task({ title: "later late", due_date: "2026-11-27" }),
        task({ title: "today", due_date: TODAY }),
        task({ title: "tomorrow", due_date: "2026-11-29" }),
        task({ title: "in a week", due_date: "2026-12-05" }),
        task({ title: "too far", due_date: "2026-12-06" }),
        done("2026-11-26", { title: "done late", due_date: "2026-11-20" }),
      ],
      [],
      TODAY,
    );
    expect(r.slipped.map((t) => t.title)).toEqual(["late", "later late"]);
    expect(r.upcoming.map((t) => t.title)).toEqual(["tomorrow", "in a week"]);
  });

  test("leaves out deleted tasks and repeating templates", () => {
    const r = weekReview([done(TODAY, { deleted: true }), done(TODAY, { repeat: "daily", origin_task_id: null })], [], TODAY);
    expect(r.done).toEqual([]);
  });

  test("focus minutes this week, and a busiest-first split by space", () => {
    const r = weekReview(
      [done("2026-11-27", { space_id: "a" }), done("2026-11-27", { space_id: "b" }), done("2026-11-26", { space_id: "b" })],
      [session("2026-11-27", 50, "a"), session("2026-11-26", 25, "b"), session("2026-11-10", 90, "a")],
      TODAY,
    );
    expect(r.focusMinutes).toBe(75);
    expect(r.bySpace).toEqual([
      { spaceId: "a", done: 1, minutes: 50 },
      { spaceId: "b", done: 2, minutes: 25 },
    ]);
  });
});

describe("insights", () => {
  test("tasks done per 7-day block, oldest first, the last ending today", () => {
    const r = insights([done(TODAY), done("2026-11-22"), done("2026-11-21"), done("2026-10-05")], [], TODAY, 3);
    expect(r.weeklyDone).toEqual([
      { from: "2026-11-08", to: "2026-11-14", count: 0 },
      { from: "2026-11-15", to: "2026-11-21", count: 1 },
      { from: "2026-11-22", to: "2026-11-28", count: 2 },
    ]);
  });

  test("14 days of focus, oldest first", () => {
    const r = insights([], [session(TODAY, 30), session(TODAY, 15), session("2026-11-15", 40), session("2026-11-14", 99)], TODAY);
    expect(r.dailyFocus).toHaveLength(14);
    expect(r.dailyFocus[0]).toEqual({ day: "2026-11-15", minutes: 40 });
    expect(r.dailyFocus[13]).toEqual({ day: TODAY, minutes: 45 });
  });

  test("streak: days in a row with something done; today doesn't break it before you start", () => {
    const tasks = [done("2026-11-27"), done("2026-11-26"), done("2026-11-25"), done("2026-11-23")];
    expect(insights(tasks, [], TODAY).streak).toBe(3);
    expect(insights([...tasks, done(TODAY)], [], TODAY).streak).toBe(4);
    expect(insights([done("2026-11-26")], [], TODAY).streak).toBe(0);
  });

  test("on time: finished on or before its day, over the last 30 days", () => {
    const r = insights(
      [
        done("2026-11-20", { due_date: "2026-11-20" }),
        done("2026-11-19", { due_date: "2026-11-25" }),
        done("2026-11-27", { due_date: "2026-11-24" }),
        done("2026-11-27"),
        done("2026-10-01", { due_date: "2026-10-01" }),
      ],
      [],
      TODAY,
    );
    expect(r.onTime).toEqual({ onTime: 2, total: 3 });
  });

  test("best weekday, or null with nothing done", () => {
    // 2026-11-24 and 2026-11-17 are Tuesdays.
    const r = insights([done("2026-11-24"), done("2026-11-17"), done("2026-11-27")], [], TODAY);
    expect(r.bestWeekday).toBe(2);
    expect(insights([], [], TODAY).bestWeekday).toBeNull();
  });

  test("focus by space over 30 days, and this week against last", () => {
    const r = insights(
      [done(TODAY), done("2026-11-20"), done("2026-11-19")],
      [session(TODAY, 20, "a"), session("2026-11-20", 60, "b"), session("2026-11-21", 10, "a"), session("2026-09-01", 500, "a")],
      TODAY,
    );
    expect(r.focusBySpace).toEqual([
      { spaceId: "b", minutes: 60 },
      { spaceId: "a", minutes: 30 },
    ]);
    expect(r.thisWeek).toEqual({ done: 1, focus: 20 });
    expect(r.lastWeek).toEqual({ done: 2, focus: 70 });
  });
});

describe("spaceLabel", () => {
  test("names, no space, and removed spaces", () => {
    const spaces = [{ id: "a", name: "Launch" }] as Space[];
    expect(spaceLabel(spaces, "a")).toBe("Launch");
    expect(spaceLabel(spaces, null)).toBe("No space");
    expect(spaceLabel(spaces, "gone")).toBe("Removed space");
  });
});
