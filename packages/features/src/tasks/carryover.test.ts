import { describe, expect, test } from "bun:test";
import type { Task } from "@nox/types";
import { carryoverTaskIds } from "./carryover";

const TODAY = "2026-07-06";

const base: Task = {
  id: "t",
  user_id: "u",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  deleted: false,
  title: "x",
  notes: null,
  due_date: "2026-06-30",
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

describe("carryoverTaskIds", () => {
  test("carries a standalone overdue pending task", () => {
    expect(carryoverTaskIds([mk({ id: "a" })], TODAY)).toEqual(["a"]);
  });

  test("re-carries an already carried_over task still overdue", () => {
    expect(carryoverTaskIds([mk({ id: "a", status: "carried_over" })], TODAY)).toEqual(["a"]);
  });

  test("excludes completed, today/future, and undated tasks", () => {
    const done = mk({ id: "done", status: "complete" });
    const todayTask = mk({ id: "today", due_date: TODAY });
    const undated = mk({ id: "none", due_date: null });
    expect(carryoverTaskIds([done, todayTask, undated], TODAY)).toEqual([]);
  });

  test("excludes recurring templates and occurrences", () => {
    const template = mk({ id: "tmpl", repeat: "daily" });
    const occurrence = mk({ id: "occ", origin_task_id: "tmpl" });
    expect(carryoverTaskIds([template, occurrence], TODAY)).toEqual([]);
  });
});
