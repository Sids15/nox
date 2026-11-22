import { z } from "zod";
import { taskPriorityLevels } from "./common";

/**
 * Replies from the `ai` Edge Function. The model is asked for exactly these shapes, but its output is
 * still untrusted: every field is validated here, unknown values are dropped rather than failing the
 * whole reply, and nothing is written to the user's data until they accept a preview.
 */

const text = (max: number) => z.string().trim().max(max * 4).transform((s) => s.slice(0, max));
const optText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((s) => (s ? s.trim().slice(0, max) || undefined : undefined));
/** A field that falls back to undefined instead of rejecting the reply. */
const lenient = <T extends z.ZodTypeAny>(schema: T) => schema.optional().catch(undefined);

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const aiTaskDraft = z.object({
  title: text(200).pipe(z.string().min(1)),
  date: lenient(dateKey),
  time: lenient(time),
  duration_minutes: lenient(z.number().int().min(5).max(1440)),
  priority: lenient(z.enum(taskPriorityLevels)),
  repeat: lenient(z.enum(["none", "daily", "weekdays", "weekly"])),
  notes: optText(2000),
});
export type AiTaskDraft = z.infer<typeof aiTaskDraft>;

/** A list that keeps the valid items and quietly drops the broken ones. */
const keepValid = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((xs) =>
      xs
        .map((x) => item.safeParse(x))
        .filter((r) => r.success)
        .map((r) => r.data as z.infer<T>)
        .slice(0, max),
    );

const tagList = keepValid(text(40).pipe(z.string().min(1)), 6).transform((t) => [
  ...new Set(t.map((s) => s.toLowerCase().replace(/^#/, ""))),
]);

export const aiExtract = z.object({
  summary: text(1000).catch(""),
  tasks: keepValid(aiTaskDraft, 20),
  tags: tagList,
});
export type AiExtract = z.infer<typeof aiExtract>;

export const aiDayPlan = z.object({
  summary: text(300).catch(""),
  slots: keepValid(
    z.object({ id: z.string(), start: time, minutes: z.number().int().min(5).max(720), reason: text(80).catch("") }),
    40,
  ),
  skipped: keepValid(z.object({ id: z.string(), reason: text(120).catch("") }), 40),
});
export type AiDayPlan = z.infer<typeof aiDayPlan>;

export const aiBreakdown = z.object({
  subtasks: keepValid(z.object({ title: text(200).pipe(z.string().min(1)), minutes: z.number().int().min(5).max(240).catch(30) }), 7),
});
export type AiBreakdown = z.infer<typeof aiBreakdown>;

export const aiNoteModes = ["summarize", "tidy", "continue", "title_tags", "actions"] as const;
export type AiNoteMode = (typeof aiNoteModes)[number];
export const aiNoteAssist = z.object({
  text: optText(20_000),
  title: optText(80),
  tags: tagList.optional().transform((t) => t ?? []),
  tasks: keepValid(aiTaskDraft, 20).optional().transform((t) => t ?? []),
});
export type AiNoteAssist = z.infer<typeof aiNoteAssist>;

export const aiIdeaCoach = z.object({
  verdict: text(300).catch(""),
  questions: keepValid(text(300).pipe(z.string().min(1)), 4),
  next_steps: keepValid(text(300).pipe(z.string().min(1)), 4),
  related: keepValid(z.string(), 3),
});
export type AiIdeaCoach = z.infer<typeof aiIdeaCoach>;

export const aiResourceTags = z.object({ summary: text(400).catch(""), tags: tagList });
export type AiResourceTags = z.infer<typeof aiResourceTags>;

export const aiAnswer = z.object({ answer: text(4000).catch(""), sources: keepValid(z.string(), 10) });
export type AiAnswer = z.infer<typeof aiAnswer>;

export const aiBrief = z.object({ text: text(2000).catch("") });
export type AiBrief = z.infer<typeof aiBrief>;

/** Any of the reply schemas above, for the repository's generic runner. */
export type AiSchema = z.ZodTypeAny;
