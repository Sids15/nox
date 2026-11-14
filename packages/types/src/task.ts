import { z } from "zod";
import { syncedRow, taskPriorityLevels } from "./common";

export const taskStatuses = ["pending", "complete", "carried_over"] as const;
export const repeatKinds = ["none", "daily", "weekly", "weekdays", "custom"] as const;

/** Config for `repeat = custom` (e.g. specific weekdays). Kept small on purpose. */
export const repeatConfig = z
  .object({
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    interval: z.number().int().positive().optional(),
  })
  .nullable()
  .default(null);

export const task = syncedRow.extend({
  title: z.string().min(1).max(200),
  notes: z.string().max(2_000).nullable().default(null),
  due_date: z.string().date().nullable().default(null),
  due_time: z.string().nullable().default(null),
  /** How long it takes, in minutes (5–1440); null = not set. Needs migration 0008. */
  duration_minutes: z.number().int().min(5).max(1440).nullable().optional(),
  reminder_times: z.array(z.string().datetime({ offset: true })).default([]),
  priority: z.enum(taskPriorityLevels).default("medium"),
  status: z.enum(taskStatuses).default("pending"),
  repeat: z.enum(repeatKinds).default("none"),
  repeat_config: repeatConfig,
  /** For carried-over / recurring occurrences: points at the originating template. */
  origin_task_id: z.string().uuid().nullable().default(null),
  sort_order: z.number().int().default(0),
  /** Streak tracking for recurring templates (see plan: split carryover model). */
  streak_count: z.number().int().nonnegative().default(0),
  longest_streak: z.number().int().nonnegative().default(0),
  last_completed_on: z.string().date().nullable().default(null),
});
export type Task = z.infer<typeof task>;

export const taskInput = task.pick({
  title: true,
  notes: true,
  due_date: true,
  due_time: true,
  duration_minutes: true,
  reminder_times: true,
  priority: true,
  repeat: true,
  repeat_config: true,
});
export type TaskInput = z.infer<typeof taskInput>;
