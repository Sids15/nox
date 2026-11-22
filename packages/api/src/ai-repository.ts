import { supabase } from "@nox/db";
import {
  aiAnswer,
  aiBreakdown,
  aiBrief,
  aiDayPlan,
  aiExtract,
  aiIdeaCoach,
  aiNoteAssist,
  aiResourceTags,
  aiTaskDraft,
  type AiAnswer,
  type AiBreakdown,
  type AiBrief,
  type AiDayPlan,
  type AiExtract,
  type AiIdeaCoach,
  type AiNoteAssist,
  type AiNoteMode,
  type AiResourceTags,
  type AiSchema,
  type AiTaskDraft,
} from "@nox/types";

/** An AI request that failed, with copy fit to show the user as-is. */
export class AiError extends Error {
  constructor(
    message: string,
    /** "daily_limit" when the day's allowance is used up; "offline" when there's no connection. */
    public code?: "daily_limit" | "not_set_up" | "offline",
  ) {
    super(message);
    this.name = "AiError";
  }
}

async function run<S extends AiSchema>(action: string, input: unknown, schema: S): Promise<S["_output"]> {
  const { data, error } = await supabase.functions.invoke("ai", { body: { action, input } });
  if (error) {
    // FunctionsHttpError carries the Response; our function always answers { error, code? }.
    const res = (error as { context?: Response }).context;
    let body: { error?: string; code?: string } | null = null;
    try {
      body = res && typeof res.json === "function" ? await res.json() : null;
    } catch {
      body = null;
    }
    if (body?.code === "daily_limit") throw new AiError(body.error ?? "Today's AI requests are used up.", "daily_limit");
    if (res?.status === 503) throw new AiError("AI isn't set up on the server yet.", "not_set_up");
    if (!res) throw new AiError("Can't reach Nox AI — check your connection.", "offline");
    throw new AiError(body?.error ?? "The AI couldn't answer. Try again.");
  }
  const parsed = schema.safeParse((data as { result?: unknown } | null)?.result);
  if (!parsed.success) throw new AiError("The AI's answer didn't make sense. Try again.");
  return parsed.data;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekdayOf = (dateKey: string) => DAYS[new Date(`${dateKey}T12:00:00`).getDay()];

export interface PlanInputTask {
  id: string;
  title: string;
  priority: string;
  minutes?: number;
  due?: string | null;
  overdue?: boolean;
}

/**
 * Sole touchpoint for the `ai` Edge Function. Every method sends only what its feature needs — never
 * a whole table — and validates the reply before anything else sees it.
 */
export const AiRepository = {
  parseTask(text: string, today: string): Promise<AiTaskDraft> {
    return run("parse_task", { text, today, weekday: weekdayOf(today) }, aiTaskDraft);
  },

  extractItems(text: string, today: string, knownTags: string[]): Promise<AiExtract> {
    return run("extract_items", { text, today, weekday: weekdayOf(today), knownTags }, aiExtract);
  },

  planDay(input: {
    date: string;
    notBefore: string;
    dayStart: string;
    dayEnd: string;
    busy: { title: string; start: string; end: string }[];
    tasks: PlanInputTask[];
  }): Promise<AiDayPlan> {
    return run("plan_day", { ...input, weekday: weekdayOf(input.date) }, aiDayPlan);
  },

  breakdown(title: string, notes?: string | null): Promise<AiBreakdown> {
    return run("breakdown_task", { title, notes: notes ?? "" }, aiBreakdown);
  },

  noteAssist(mode: AiNoteMode, input: { title?: string; text: string; today: string; knownTags: string[] }): Promise<AiNoteAssist> {
    return run("note_assist", { mode, ...input }, aiNoteAssist);
  },

  ideaCoach(
    idea: { title: string; body: string; status: string; priority: string },
    others: { id: string; title: string }[],
  ): Promise<AiIdeaCoach> {
    return run("idea_coach", { idea, others }, aiIdeaCoach);
  },

  tagResource(resource: { title?: string | null; url?: string | null; domain?: string | null; body?: string | null }, knownTags: string[]): Promise<AiResourceTags> {
    return run("tag_resource", { resource, knownTags }, aiResourceTags);
  },

  ask(question: string, today: string, context: { id: string; kind: string; title: string; text: string }[]): Promise<AiAnswer> {
    return run("ask", { question, today, context }, aiAnswer);
  },

  brief(kind: "daily" | "weekly", today: string, data: unknown): Promise<AiBrief> {
    return run("brief", { kind, today, weekday: weekdayOf(today), data }, aiBrief);
  },

  /** Requests used today, for the Settings line. Null when unknown (offline, or migration 0009 missing). */
  async usedToday(): Promise<number | null> {
    // The server counts by its own (UTC) date.
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from("ai_usage").select("count").eq("day", today).maybeSingle();
    if (error) return null;
    return (data as { count?: number } | null)?.count ?? 0;
  },
};
