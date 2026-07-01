import { z } from "zod";
import { priorityLevels, syncedRow } from "./common";

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
  priority: z.enum(priorityLevels).default("medium"),
  status: z.enum(ideaStatuses).default("raw"),
  tags: z.array(z.string().min(1).max(40)).default([]),
  is_archived: z.boolean().default(false),
});
export type Idea = z.infer<typeof idea>;

/** Fields a user may set when creating/editing an idea. */
export const ideaInput = idea.pick({
  title: true,
  description: true,
  priority: true,
  status: true,
  tags: true,
});
export type IdeaInput = z.infer<typeof ideaInput>;
