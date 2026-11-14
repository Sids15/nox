import { supabase } from "@nox/db";
import { tag, tagInput, type Tag, type TagInput } from "@nox/types";

/** Sole Supabase touchpoint for user-defined resource tags. */
export const TagRepository = {
  async list(): Promise<Tag[]> {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("deleted", false)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return tag.array().parse(data ?? []);
  },

  async create(input: TagInput, id: string): Promise<Tag> {
    const parsed = tagInput.parse(input);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("tags")
      .insert({ ...parsed, id, user_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return tag.parse(data);
  },

  /** Rename or recolour a tag. */
  async update(id: string, patch: Partial<TagInput>): Promise<Tag> {
    const parsed = tagInput.partial().parse(patch);
    const { data, error } = await supabase.from("tags").update(parsed).eq("id", id).select().single();
    if (error) throw error;
    return tag.parse(data);
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from("tags").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};
