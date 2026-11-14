import { supabase } from "@nox/db";
import { folder, folderInput, type Folder, type FolderInput } from "@nox/types";

/** Sole Supabase touchpoint for note folders. Session-derived `user_id`, Zod in/out, soft-delete. */
export const FolderRepository = {
  async list(): Promise<Folder[]> {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("deleted", false)
      .order("name", { ascending: true });
    if (error) throw error;
    return folder.array().parse(data ?? []);
  },

  async create(input: FolderInput, id: string): Promise<Folder> {
    const parsed = folderInput.parse(input);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("folders")
      .insert({ ...parsed, id, user_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return folder.parse(data);
  },

  async rename(id: string, name: string): Promise<Folder> {
    const { data, error } = await supabase
      .from("folders")
      .update({ name })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return folder.parse(data);
  },

  /**
   * Delete a folder, moving its notes out to "no folder" first. Notes are never deleted with their
   * folder. Order matters: unfiling first means a failure in between leaves the folder still there
   * with fewer notes in it — harmless — rather than notes still pointing at a deleted folder, which
   * is what this used to leave behind (filed under nothing reachable, and re-filed nowhere).
   */
  async softDelete(id: string): Promise<void> {
    const { error: unfileError } = await supabase
      .from("notes")
      .update({ folder_id: null })
      .eq("folder_id", id);
    if (unfileError) throw unfileError;

    const { error } = await supabase.from("folders").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};
