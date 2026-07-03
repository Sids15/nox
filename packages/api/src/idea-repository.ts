import { supabase } from "@nox/db";
import { idea, ideaInput, type Idea, type IdeaInput } from "@nox/types";

export type IdeaStatus = Idea["status"];

/**
 * The only module that touches Supabase for ideas. Same contract as TaskRepository: Zod-validate in
 * and out, derive `user_id` from the session (never the caller) on top of RLS, and soft-delete so
 * removals propagate. Ideas are ordered most-recently-updated first.
 */
export const IdeaRepository = {
  async list(): Promise<Idea[]> {
    const { data, error } = await supabase
      .from("ideas")
      .select("*")
      .eq("deleted", false)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return idea.array().parse(data ?? []);
  },

  async create(input: IdeaInput, id: string): Promise<Idea> {
    const parsed = ideaInput.parse(input);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("ideas")
      .insert({ ...parsed, id, user_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return idea.parse(data);
  },

  async update(id: string, patch: Partial<IdeaInput>): Promise<Idea> {
    const parsed = ideaInput.partial().parse(patch);
    const { data, error } = await supabase
      .from("ideas")
      .update(parsed)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return idea.parse(data);
  },

  async setStatus(id: string, status: IdeaStatus): Promise<Idea> {
    const { data, error } = await supabase
      .from("ideas")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return idea.parse(data);
  },

  async setArchived(id: string, isArchived: boolean): Promise<Idea> {
    const { data, error } = await supabase
      .from("ideas")
      .update({ is_archived: isArchived })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return idea.parse(data);
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from("ideas").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};
