import { z } from "zod";
import { syncedRow } from "./common";

export const noteTypes = ["text", "voice", "sketch", "mixed"] as const;

/** Block-JSON note content. Media blocks reference a Storage object path (once
 *  uploaded) and/or a local file URI (offline capture); never a public URL. */
export const noteBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().default("") }),
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    text: z.string().default(""),
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
export type NoteBlock = z.infer<typeof noteBlock>;

export const note = syncedRow.extend({
  title: z.string().max(200).nullable().default(null),
  type: z.enum(noteTypes).default("text"),
  content: z.array(noteBlock).default([]),
  folder_id: z.string().uuid().nullable().default(null),
  tags: z.array(z.string().min(1).max(40)).default([]),
  is_pinned: z.boolean().default(false),
  is_archived: z.boolean().default(false),
});
export type Note = z.infer<typeof note>;

/** Fields a user may set when creating/editing a note. */
export const noteInput = note.pick({
  title: true,
  type: true,
  content: true,
  folder_id: true,
  tags: true,
});
export type NoteInput = z.infer<typeof noteInput>;

export const folder = syncedRow.extend({
  name: z.string().min(1).max(80),
  parent_id: z.string().uuid().nullable().default(null),
});
export type Folder = z.infer<typeof folder>;

export const folderInput = folder.pick({ name: true, parent_id: true });
export type FolderInput = z.infer<typeof folderInput>;
