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
    /** Why it failed, when the app should react to the reason (not just show the message). */
    public code?: "daily_limit" | "rate_limited" | "ai_disabled" | "not_set_up" | "offline",
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
    if (body?.code === "daily_limit" || body?.code === "rate_limited" || body?.code === "ai_disabled")
      throw new AiError(body.error ?? "Nox AI can't answer right now.", body.code);
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

  /** Requests each account may make a day: the server's AI_DAILY_LIMIT default (supabase/functions/ai). */
  dailyLimit: 40,

  /** Requests used today, for the Settings line. Null when unknown (offline, or migration 0010 missing). */
  async usedToday(): Promise<number | null> {
    // The server counts by its own (UTC) date.
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from("rate_limits").select("count").eq("bucket", "ai").eq("day", today).maybeSingle();
    if (error) return null;
    return (data as { count?: number } | null)?.count ?? 0;
  },

  /** The account-wide Nox AI switch (users.ai_enabled). Null when it can't be read. */
  async accountEnabled(): Promise<boolean | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabase.from("users").select("ai_enabled").eq("id", session.user.id).maybeSingle();
    if (error || !data) return null;
    return (data as { ai_enabled?: boolean }).ai_enabled !== false;
  },

  /** Turn Nox AI on or off for the whole account — the server refuses AI requests while it's off. */
  async setAccountEnabled(enabled: boolean): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");
    const { error } = await supabase.from("users").update({ ai_enabled: enabled }).eq("id", session.user.id);
    if (error) throw error;
  },
};
