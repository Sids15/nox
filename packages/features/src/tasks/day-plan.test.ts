import { describe, expect, test } from "bun:test";
import type { Task } from "@nox/types";
import { minutesToTime, tasksOnDay, timeToMinutes } from "./day-plan";

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
