import { supabase } from "@nox/db";
import { note, noteInput, type Note, type NoteInput } from "@nox/types";

/**
 * Sole Supabase touchpoint for notes. Same contract as the other repositories: Zod-validate in and
 * out, derive `user_id` from the session, soft-delete. Notes are ordered most-recently-updated first.
 */
export const NoteRepository = {
  async list(): Promise<Note[]> {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("deleted", false)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return note.array().parse(data ?? []);
  },

  async create(input: NoteInput, id: string): Promise<Note> {
    const parsed = noteInput.parse(input);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("notes")
      .insert({ ...parsed, id, user_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return note.parse(data);
  },

  async update(id: string, patch: Partial<NoteInput>): Promise<Note> {
    const parsed = noteInput.partial().parse(patch);
    const { data, error } = await supabase
      .from("notes")
      .update(parsed)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return note.parse(data);
  },

  async setPinned(id: string, isPinned: boolean): Promise<Note> {
    const { data, error } = await supabase
      .from("notes")
      .update({ is_pinned: isPinned })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return note.parse(data);
  },

  async setArchived(id: string, isArchived: boolean): Promise<Note> {
    const { data, error } = await supabase
      .from("notes")
      .update({ is_archived: isArchived })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return note.parse(data);
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from("notes").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};
