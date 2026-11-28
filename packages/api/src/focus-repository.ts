import { supabase } from "@nox/db";
import { focusSession, focusSessionInput, type FocusSession, type FocusSessionInput } from "@nox/types";

/** A database without migration 0016 has no focus_sessions table: no sessions, not an error. */
const isMissingTable = (error: { code?: string } | null) =>
  error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202";

async function userId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

/** How far back Focus and Insights look. */
const HISTORY_DAYS = 400;

/** Sole Supabase touchpoint for focus sessions. Session-derived `user_id`, Zod in/out, soft-delete. */
export const FocusRepository = {
  async list(): Promise<FocusSession[]> {
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("focus_sessions")
      .select("*")
      .eq("deleted", false)
      .gte("started_at", since)
      .order("started_at", { ascending: false });
    if (isMissingTable(error)) return [];
    if (error) throw error;
    return focusSession.array().parse(data ?? []);
  },

  async create(input: FocusSessionInput, id: string): Promise<FocusSession> {
    const parsed = focusSessionInput.parse(input);
    const { data, error } = await supabase
      .from("focus_sessions")
      .insert({ ...parsed, id, user_id: await userId() })
      .select()
      .single();
    if (error) throw error;
    return focusSession.parse(data);
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from("focus_sessions").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};
