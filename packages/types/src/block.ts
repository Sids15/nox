import { z } from "zod";

/**
 * Shared block-JSON content model used by both notes and ideas (free-flow documents). Media blocks
 * reference a Storage object path (once uploaded) and/or a local file URI (offline capture) — never
 * a public URL. `link` embeds a saved URL card; `image`/`audio`/`sketch` are media.
 */
export const contentBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().default("") }),
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    text: z.string().default(""),
  }),
  z.object({
    type: z.literal("link"),
    url: z.string().max(4000),
    title: z.string().max(1000).nullable().default(null),
    domain: z.string().max(300).nullable().default(null),
    thumbnail: z.string().max(4000).nullable().default(null),
  }),
  z.object({
    type: z.literal("image"),
    storagePath: z.string().nullable().default(null),
    localUri: z.string().nullable().default(null),
    width: z.number().int().positive().default(1),
    height: z.number().int().positive().default(1),
  }),
  z.object({
    type: z.literal("audio"),
    storagePath: z.string().nullable().default(null),
    localUri: z.string().nullable().default(null),
    durationMs: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("sketch"),
    storagePath: z.string().nullable().default(null),
    localUri: z.string().nullable().default(null),
    width: z.number().int().positive().default(1),
    height: z.number().int().positive().default(1),
  }),
]);
export type ContentBlock = z.infer<typeof contentBlock>;
