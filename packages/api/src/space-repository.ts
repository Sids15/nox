import { supabase } from "@nox/db";
import {
  space,
  spaceInput,
  template,
  templateInput,
  type Space,
  type SpaceInput,
  type Template,
  type TemplateInput,
} from "@nox/types";

/**
 * A database without migration 0012 has no spaces/templates tables yet. Reading one is not an error
 * worth breaking the app over: there are simply no spaces until the migration runs.
 */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202";
}

async function userId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

/** Sole Supabase touchpoint for spaces. Session-derived `user_id`, Zod in/out, soft-delete. */
export const SpaceRepository = {
  async list(): Promise<Space[]> {
    const { data, error } = await supabase
      .from("spaces")
      .select("*")
      .eq("deleted", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (isMissingTable(error)) return [];
    if (error) throw error;
    return space.array().parse(data ?? []);
  },

  async create(input: SpaceInput, id: string): Promise<Space> {
    const parsed = spaceInput.parse(input);
    const { data, error } = await supabase
      .from("spaces")
      .insert({ ...parsed, id, user_id: await userId() })
      .select()
      .single();
    if (error) throw error;
    return space.parse(data);
  },

  async update(id: string, patch: Partial<SpaceInput>): Promise<Space> {
    const parsed = spaceInput.partial().parse(patch);
    const { data, error } = await supabase.from("spaces").update(parsed).eq("id", id).select().single();
    if (error) throw error;
    return space.parse(data);
  },

  /**
   * Delete a space. Its pages are kept: they move out of the space first (the same order as folder
   * deletion — a failure in between leaves a space with fewer pages, never pages in a deleted space).
   */
  async softDelete(id: string): Promise<void> {
    for (const table of ["notes", "ideas", "tasks", "resources"] as const) {
      const { error } = await supabase.from(table).update({ space_id: null }).eq("space_id", id);
      if (error) throw error;
    }
    const { error } = await supabase.from("spaces").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};

/** Sole Supabase touchpoint for the user's own templates (the built-in ones live in the app). */
export const TemplateRepository = {
  async list(): Promise<Template[]> {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("deleted", false)
      .order("name", { ascending: true });
    if (isMissingTable(error)) return [];
    if (error) throw error;
    return template.array().parse(data ?? []);
  },

  async create(input: TemplateInput, id: string): Promise<Template> {
    const parsed = templateInput.parse(input);
    const { data, error } = await supabase
      .from("templates")
      .insert({ ...parsed, id, user_id: await userId() })
      .select()
      .single();
    if (error) throw error;
    return template.parse(data);
  },

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from("templates").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};
