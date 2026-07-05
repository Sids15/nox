import { describe, expect, test } from "bun:test";
import type { Task } from "@nox/types";
import { diffTaskReminders, MAX_TASK_REMINDERS, planTaskReminders, taskReminderId } from "./notification-plan";

const NOW = Date.parse("2026-07-05T12:00:00Z");
const future = (mins: number) => new Date(NOW + mins * 60_000).toISOString();
const past = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

const base: Task = {
  id: "t",
  user_id: "u",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  deleted: false,
  title: "Task",
  notes: null,
  due_date: "2026-07-05",
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
const mk = (over: Partial<Task>): Task => ({ ...base, ...over });

describe("planTaskReminders", () => {
  test("schedules only future reminders on incomplete tasks", () => {
    const iso = future(30);
    const plan = planTaskReminders([mk({ id: "a", reminder_times: [past(30), iso] })], NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: taskReminderId("a", iso), title: "Task", taskId: "a" });
  });

  test("excludes completed tasks entirely", () => {
    const plan = planTaskReminders([mk({ id: "a", status: "complete", reminder_times: [future(10)] })], NOW);
    expect(plan).toEqual([]);
  });

  test("orders soonest-first across tasks", () => {
    const plan = planTaskReminders(
      [
        mk({ id: "a", reminder_times: [future(60)] }),
        mk({ id: "b", reminder_times: [future(5)] }),
        mk({ id: "c", reminder_times: [future(30)] }),
      ],
      NOW,
    );
    expect(plan.map((p) => p.taskId)).toEqual(["b", "c", "a"]);
  });

  test("a task with multiple reminders yields one schedule each", () => {
    const plan = planTaskReminders([mk({ id: "a", reminder_times: [future(10), future(20)] })], NOW);
    expect(plan.map((p) => p.id)).toEqual([taskReminderId("a", future(10)), taskReminderId("a", future(20))]);
  });

  test("caps at the platform limit, keeping the soonest", () => {
    const times = Array.from({ length: MAX_TASK_REMINDERS + 10 }, (_, i) => future(i + 1));
    const plan = planTaskReminders([mk({ id: "a", reminder_times: times })], NOW);
    expect(plan).toHaveLength(MAX_TASK_REMINDERS);
    expect(plan[0]!.id).toBe(taskReminderId("a", times[0]!));
  });
});

describe("diffTaskReminders", () => {
  test("cancels stale task schedules and adds missing ones, ignoring non-task ids", () => {
    const keep = future(10);
    const add = future(20);
    const desired = planTaskReminders([mk({ id: "a", reminder_times: [keep, add] })], NOW);
    const existing = [taskReminderId("a", keep), taskReminderId("a", past(5)), "daily:morning"];

    const { toCancel, toSchedule } = diffTaskReminders(desired, existing);
    // The already-past schedule for "a" is no longer desired → cancel; the daily nudge is untouched.
    expect(toCancel).toEqual([taskReminderId("a", past(5))]);
    // "keep" already scheduled → not re-added; "add" is new → scheduled.
    expect(toSchedule.map((d) => d.id)).toEqual([taskReminderId("a", add)]);
  });

  test("empty desired cancels every task schedule (toggle off)", () => {
    const existing = [taskReminderId("a", future(10)), "daily:endOfDay"];
    const { toCancel, toSchedule } = diffTaskReminders([], existing);
    expect(toCancel).toEqual([taskReminderId("a", future(10))]);
    expect(toSchedule).toEqual([]);
  });
});
