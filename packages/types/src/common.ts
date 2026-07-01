import { z } from "zod";

/** ISO-8601 timestamp string (as returned by Supabase). */
export const timestamp = z.string().datetime({ offset: true });

/** Fields shared by every synced row. `deleted` is the soft-delete tombstone the
 *  local-first sync engine uses to propagate removals (see rules.md / db package). */
export const syncedRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: timestamp,
  updated_at: timestamp,
  deleted: z.boolean().default(false),
});
export type SyncedRow = z.infer<typeof syncedRow>;

export const priorityLevels = ["low", "medium", "high", "critical"] as const;
export const taskPriorityLevels = ["low", "medium", "high"] as const;
