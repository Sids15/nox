import { z } from "zod";
import { syncedRow, timestamp } from "./common";

/** One stretch of focused work (migration 0016): how long, on what task, in which space. */
export const focusSession = syncedRow.extend({
  task_id: z.string().uuid().nullable().default(null),
  space_id: z.string().uuid().nullable().default(null),
  started_at: timestamp,
  /** Whole minutes actually focused (pauses excluded), 1–600. */
  minutes: z.number().int().min(1).max(600),
});
export type FocusSession = z.infer<typeof focusSession>;

export const focusSessionInput = focusSession.pick({ task_id: true, space_id: true, started_at: true, minutes: true });
export type FocusSessionInput = z.infer<typeof focusSessionInput>;
