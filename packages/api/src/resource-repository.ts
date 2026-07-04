import { supabase } from "@nox/db";
import { resource, resourceInput, type Resource, type ResourceInput } from "@nox/types";

/** Sole Supabase touchpoint for saved resources. Session-derived user_id, Zod in/out, soft-delete. */
export const ResourceRepository = {
  async list(): Promise<Resource[]> {
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .eq("deleted", false)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return resource.array().parse(data ?? []);
  },

  async create(input: ResourceInput, id: string): Promise<Resource> {
    const parsed = resourceInput.parse(input);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("resources")
      .insert({ ...parsed, id, user_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return resource.parse(data);
  },

  async update(id: string, patch: Partial<ResourceInput>): Promise<Resource> {
    const parsed = resourceInput.partial().parse(patch);
    const { data, error } = await supabase
      .from("resources")
      .update(parsed)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return resource.parse(data);
  },

  async setArchived(id: string, isArchived: boolean): Promise<Resource> {
    const { data, error } = await supabase
      .from("resources")
      .update({ is_archived: isArchived })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return resource.parse(data);
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from("resources").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};
