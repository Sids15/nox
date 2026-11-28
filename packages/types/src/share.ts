import { z } from "zod";
import { syncedRow } from "./common";

export const shareKinds = ["note", "idea", "space"] as const;
export type ShareKind = (typeof shareKinds)[number];

/** A read-only share link (migration 0018). The token is made by the database. */
export const share = syncedRow.extend({
  token: z.string().regex(/^[0-9a-f]{64}$/),
  kind: z.enum(shareKinds),
  target_id: z.string().uuid(),
});
export type Share = z.infer<typeof share>;

const block = z.union([
  z.object({ type: z.enum(["paragraph", "heading"]), text: z.string().max(20_000), level: z.number().int().min(1).max(3).optional() }),
  z.object({ type: z.literal("link"), url: z.string().url().max(2000), title: z.string().max(500).nullable() }),
]);

/** What a share link shows (from the `share` function): a text-only copy. */
export const sharedView = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["note", "idea"]),
    title: z.string().max(200),
    status: z.string().max(20).nullable(),
    description: z.string().max(20_000).nullable(),
    blocks: z.array(block).max(400),
    updated_at: z.string().max(40),
  }),
  z.object({
    kind: z.literal("space"),
    name: z.string().max(80),
    icon: z.string().max(16),
    goal: z.string().max(500).nullable(),
    due_date: z.string().nullable(),
    tasks: z.array(z.object({ title: z.string().max(200), done: z.boolean(), due_date: z.string().nullable() })).max(300),
    pages: z.array(z.object({ kind: z.enum(["note", "idea"]), title: z.string().max(200) })).max(200),
    updated_at: z.string().max(40),
  }),
]);
export type SharedView = z.infer<typeof sharedView>;
