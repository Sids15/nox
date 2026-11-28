import { z } from "zod";

/** Which server reminders an account wants (users.push_prefs, migration 0019). */
export const pushPrefs = z.object({
  morning: z.boolean().catch(true),
  overdue: z.boolean().catch(true),
  deadlines: z.boolean().catch(true),
  hour: z.number().int().min(0).max(23).catch(8),
});
export type PushPrefs = z.infer<typeof pushPrefs>;
