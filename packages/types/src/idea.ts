import { z } from "zod";
import { contentBlock } from "./block";
import { priorityLevels, syncedRow } from "./common";
import { pageExtras, pageExtrasInput } from "./space";

export const ideaStatuses = [
  "raw",
  "exploring",
  "validating",
  "complete",
  "dropped",
] as const;

export const idea = syncedRow.extend({
  title: z.string().min(1).max(200),
  description: z.string().max(20_000).nullable().default(null),
  /** Free-flow block content (paragraphs/headings/links/images/voice) — the iOS-Notes-style body. */
  content: z.array(contentBlock).default([]),
  priority: z.enum(priorityLevels).default("medium"),
  status: z.enum(ideaStatuses).default("raw"),
  tags: z.array(z.string().min(1).max(40)).default([]),
  is_archived: z.boolean().default(false),
  ...pageExtras,
});
export type Idea = z.infer<typeof idea>;

/** Fields a user may set when creating/editing an idea. */
export const ideaInput = idea
  .pick({
    title: true,
    description: true,
    content: true,
    priority: true,
    status: true,
    tags: true,
  })
  .extend(pageExtrasInput);
export type IdeaInput = z.infer<typeof ideaInput>;
