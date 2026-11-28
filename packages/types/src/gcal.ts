import { z } from "zod";

/** Another event on the person's Google Calendar (busy time), as the gcal function sends it. */
export const googleEvent = z.object({
  id: z.string().max(1024),
  title: z.string().max(200),
  start: z.string().max(40),
  end: z.string().max(40),
  allDay: z.boolean(),
  link: z.string().url().max(2000).nullable(),
});
export type GoogleEvent = z.infer<typeof googleEvent>;

export const gcalSync = z.object({
  connected: z.boolean(),
  email: z.string().max(320).nullable().optional(),
  events: z.array(z.unknown()).catch([]).transform((xs) => xs.flatMap((x) => {
    const r = googleEvent.safeParse(x);
    return r.success ? [r.data] : [];
  })),
  changed: z.number().int().nonnegative().optional(),
});
export type GcalSync = z.infer<typeof gcalSync>;

export interface GcalStatus {
  email: string | null;
  push_tasks: boolean;
  last_synced_at: string | null;
}
