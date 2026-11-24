import { describe, expect, test } from "bun:test";
import type { Task } from "@nox/types";
import { autoSchedule, checkPlan, findFreeSlot, minutesToTime, tasksOnDay, timeToMinutes } from "./day-plan";

const MON = "2026-07-06"; // a Monday
const TUE = "2026-07-07";
const base: Task = {
  id: "t",
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
  space_id: null,
};
const mk = (o: Partial<Task>): Task => ({ ...base, ...o });
const ids = (r: { task: Task; projected: boolean }[]) => r.map((p) => `${p.task.id}${p.projected ? "*" : ""}`);

describe("tasksOnDay", () => {
  test("dated tasks, sorted by time with untimed last", () => {
    const tasks = [mk({ id: "a" }), mk({ id: "b", due_time: "09:00" }), mk({ id: "c", due_time: "07:30" }), mk({ id: "d", due_date: TUE })];
    expect(ids(tasksOnDay(tasks, MON, MON))).toEqual(["c", "b", "a"]);
  });

  test("undated tasks only show on today", () => {
    const tasks = [mk({ id: "u", due_date: null })];
    expect(ids(tasksOnDay(tasks, MON, MON))).toEqual(["u"]);
    expect(ids(tasksOnDay(tasks, TUE, MON))).toEqual([]);
  });

  test("projects a repeating task onto future days it occurs", () => {
    const daily = mk({ id: "r", repeat: "daily" });
    expect(ids(tasksOnDay([daily], TUE, MON))).toEqual(["r*"]);
    expect(ids(tasksOnDay([daily], MON, MON))).toEqual(["r"]); // its own anchor day: the real row
  });

  test("doesn't project when the occurrence already exists, nor onto past days", () => {
    const daily = mk({ id: "r", repeat: "daily" });
    const occ = mk({ id: "o", due_date: TUE, origin_task_id: "r" });
    expect(ids(tasksOnDay([daily, occ], TUE, MON))).toEqual(["o"]);
    expect(ids(tasksOnDay([mk({ id: "r", repeat: "daily", due_date: "2026-07-01" })], MON, TUE))).toEqual([]);
  });

  test("a deleted occurrence keeps its repeat from being projected back", () => {
    const daily = mk({ id: "r", repeat: "daily" });
    const gone = mk({ id: "o", due_date: TUE, origin_task_id: "r", deleted: true });
    expect(ids(tasksOnDay([daily, gone], TUE, MON))).toEqual([]);
  });

  test("a skipped (deleted, not in the list) occurrence isn't projected", () => {
    const daily = mk({ id: "r", repeat: "daily" });
    expect(ids(tasksOnDay([daily], TUE, MON, new Set([`r:${TUE}`])))).toEqual([]);
  });

  test("skips deleted tasks", () => {
    expect(ids(tasksOnDay([mk({ id: "x", deleted: true })], MON, MON))).toEqual([]);
  });
});

describe("time helpers", () => {
  test("round-trip", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("18:05:00")).toBe(1085);
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(-5)).toBe("00:00");
    expect(minutesToTime(2000)).toBe("23:59");
  });
});

describe("findFreeSlot / autoSchedule", () => {
  const day = (tasks: Task[]) => tasksOnDay(tasks, MON, MON);
  const opts = { dayStart: 9 * 60, dayEnd: 12 * 60 };

  test("first gap long enough, around busy tasks", () => {
    const busy = [mk({ id: "a", due_time: "09:00", duration_minutes: 60 }), mk({ id: "b", due_time: "10:30" })];
    expect(findFreeSlot(day(busy), 30, opts)).toBe("10:00");
    expect(findFreeSlot(day(busy), 60, opts)).toBe("11:00");
    expect(findFreeSlot(day(busy), 120, opts)).toBeNull();
  });

  test("respects notBefore and rounds up to the step", () => {
    expect(findFreeSlot([], 30, { ...opts, notBefore: 9 * 60 + 7 })).toBe("09:15");
  });

  test("ignores completed tasks", () => {
    const done = [mk({ id: "a", due_time: "09:00", duration_minutes: 120, status: "complete" })];
    expect(findFreeSlot(day(done), 30, opts)).toBe("09:00");
  });

  test("places high priority first and leaves out what doesn't fit", () => {
    const low = mk({ id: "low", priority: "low", duration_minutes: 60 });
    const high = mk({ id: "high", priority: "high", duration_minutes: 120 });
    const big = mk({ id: "big", duration_minutes: 180 });
    expect(autoSchedule([], [low, big, high], opts)).toEqual([
      { id: "high", time: "09:00" },
      { id: "low", time: "11:00" },
    ]);
  });
});

describe("checkPlan", () => {
  const opts = { dayStart: 9 * 60, dayEnd: 18 * 60, notBefore: 10 * 60 };
  const meeting = { task: mk({ id: "m", due_time: "11:00", duration_minutes: 60 }), projected: false };
  const a = mk({ id: "a" });
  const b = mk({ id: "b" });

  test("keeps good placements, sorted by time", () => {
    expect(
      checkPlan([meeting], [a, b], [
        { id: "b", start: "13:00", minutes: 30 },
        { id: "a", start: "10:00", minutes: 45 },
      ], opts),
    ).toEqual([
      { id: "a", time: "10:00", minutes: 45 },
      { id: "b", time: "13:00", minutes: 30 },
    ]);
  });

  test("drops clashes, unknown ids, repeats, bad times and anything outside the hours", () => {
    expect(
      checkPlan([meeting], [a, b], [
        { id: "a", start: "11:30", minutes: 30 }, // clashes with the meeting
        { id: "x", start: "14:00", minutes: 30 }, // not offered
        { id: "b", start: "09:30", minutes: 30 }, // before notBefore
        { id: "b", start: "17:45", minutes: 30 }, // runs past the day
        { id: "b", start: "25:00", minutes: 30 }, // not a time
        { id: "a", start: "14:00", minutes: 60 },
        { id: "b", start: "14:30", minutes: 30 }, // overlaps the kept "a"
        { id: "a", start: "16:00", minutes: 30 }, // "a" already placed
      ], opts),
    ).toEqual([{ id: "a", time: "14:00", minutes: 60 }]);
  });
});
