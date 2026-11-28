import { supabase } from "@nox/db";
import { pushPrefs, type PushPrefs } from "@nox/types";

const isMissing = (error: { code?: string } | null) =>
  ["42P01", "PGRST205", "PGRST202", "PGRST204", "42703"].includes(error?.code ?? "");

async function userId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

/** Server reminders (migration 0019): this account's devices and which reminders it wants. */
export const PushRepository = {
  /** Add or refresh this device (its push address and time zone). */
  async register(device: { kind: "expo" | "web"; token: string; keys?: { p256dh: string; auth: string } | null; tz: string }): Promise<void> {
    const { error } = await supabase
      .from("push_devices")
      .upsert({ user_id: await userId(), kind: device.kind, token: device.token.slice(0, 1000), keys: device.keys ?? null, tz: device.tz.slice(0, 64) }, { onConflict: "token" });
    if (error) throw error;
  },

  /** Forget this device (switched off here, or signing out). */
  async unregister(token: string): Promise<void> {
    const { error } = await supabase.from("push_devices").delete().eq("token", token);
    if (error && !isMissing(error)) throw error;
  },

  /** Null on a database without migration 0019. */
  async prefs(): Promise<PushPrefs | null> {
    const { data, error } = await supabase.from("users").select("push_prefs").eq("id", await userId()).maybeSingle();
    if (isMissing(error) || error || !data) return null;
    return pushPrefs.parse((data as { push_prefs?: unknown }).push_prefs ?? {});
  },

  async setPrefs(prefs: PushPrefs): Promise<void> {
    const { error } = await supabase.from("users").update({ push_prefs: pushPrefs.parse(prefs) }).eq("id", await userId());
    if (error) throw error;
  },
};
