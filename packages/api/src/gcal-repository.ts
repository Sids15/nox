import { supabase } from "@nox/db";
import { gcalSync, type GcalStatus, type GcalSync } from "@nox/types";

const isMissing = (error: { code?: string } | null) => ["42P01", "PGRST205", "PGRST202"].includes(error?.code ?? "");

async function userId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

async function call(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("gcal", { body });
  if (error) throw error;
  return data;
}

/** Google Calendar (migration 0021 + the gcal function). Tokens never reach the app. */
export const GcalRepository = {
  /** Null when not connected; undefined on a database without 0021. */
  async status(): Promise<GcalStatus | null | undefined> {
    const { data, error } = await supabase.from("gcal_accounts").select("google_email, push_tasks, last_synced_at").eq("user_id", await userId()).maybeSingle();
    if (isMissing(error)) return undefined;
    if (error) throw error;
    if (!data) return null;
    const r = data as { google_email: string | null; push_tasks: boolean; last_synced_at: string | null };
    return { email: r.google_email, push_tasks: r.push_tasks, last_synced_at: r.last_synced_at };
  },

  /** The Google consent page to open; Google sends the browser back to `returnTo` (?gcal=connected). */
  async start(returnTo: string): Promise<string> {
    const data = (await call({ action: "start", returnTo })) as { url?: unknown };
    if (typeof data?.url !== "string" || !data.url.startsWith("https://accounts.google.com/")) throw new Error("Couldn't start");
    return data.url;
  },

  /** Bring tasks and events into step, and get the other events between two days. */
  async sync(from: string, to: string): Promise<GcalSync> {
    return gcalSync.parse(await call({ action: "sync", from, to }));
  },

  async disconnect(): Promise<void> {
    await call({ action: "disconnect" });
  },

  async setPushTasks(on: boolean): Promise<void> {
    const { error } = await supabase.from("gcal_accounts").update({ push_tasks: on }).eq("user_id", await userId());
    if (error) throw error;
  },
};
