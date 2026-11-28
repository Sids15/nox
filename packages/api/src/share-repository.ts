import { supabase } from "@nox/db";
import { share, sharedView, type Share, type ShareKind, type SharedView } from "@nox/types";

const isMissingTable = (error: { code?: string } | null) =>
  error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202";

async function userId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

/** Read-only share links: the owner's side (RLS) and the public read (the `share` function). */
export const ShareRepository = {
  /** The live link for one note, idea or space, if it has one. Null on a database without 0018. */
  async forTarget(kind: ShareKind, targetId: string): Promise<Share | null> {
    const { data, error } = await supabase
      .from("shares")
      .select("*")
      .eq("kind", kind)
      .eq("target_id", targetId)
      .eq("deleted", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (isMissingTable(error)) return null;
    if (error) throw error;
    return data ? share.parse(data) : null;
  },

  /** Make a link. The database picks the token. */
  async create(kind: ShareKind, targetId: string): Promise<Share> {
    const { data, error } = await supabase
      .from("shares")
      .insert({ kind, target_id: targetId, user_id: await userId() })
      .select()
      .single();
    if (error) throw error;
    return share.parse(data);
  },

  /** Stop sharing: the link stops working straight away. */
  async revoke(id: string): Promise<void> {
    const { error } = await supabase.from("shares").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },

  /** Anyone: what a link shows. Null when the link doesn't work (removed, or never existed). */
  async open(token: string): Promise<SharedView | null> {
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    const { data, error } = await supabase.functions.invoke("share", { body: { token } });
    if (error || !data) return null;
    const parsed = sharedView.safeParse(data);
    return parsed.success ? parsed.data : null;
  },
};
