import { z } from "zod";
import { contentBlock } from "./block";
import { syncedRow } from "./common";
import { pageExtras, pageExtrasInput } from "./space";

export const noteTypes = ["text", "voice", "sketch", "mixed"] as const;

/** Notes share the block-JSON content model in `block.ts`. */
export const noteBlock = contentBlock;
export type NoteBlock = z.infer<typeof noteBlock>;

export const note = syncedRow.extend({
  title: z.string().max(200).nullable().default(null),
  type: z.enum(noteTypes).default("text"),
  content: z.array(contentBlock).default([]),
  folder_id: z.string().uuid().nullable().default(null),
  tags: z.array(z.string().min(1).max(40)).default([]),
  is_pinned: z.boolean().default(false),
  is_archived: z.boolean().default(false),
  ...pageExtras,
});
export type Note = z.infer<typeof note>;

/** Fields a user may set when creating/editing a note. */
export const noteInput = note
  .pick({
    title: true,
    type: true,
    content: true,
    folder_id: true,
    tags: true,
  })
  .extend(pageExtrasInput);
export type NoteInput = z.infer<typeof noteInput>;

export const folder = syncedRow.extend({
  name: z.string().min(1).max(80),
  parent_id: z.string().uuid().nullable().default(null),
});
export type Folder = z.infer<typeof folder>;

export const folderInput = folder.pick({ name: true, parent_id: true });
export type FolderInput = z.infer<typeof folderInput>;
