import { supabase } from "@nox/db";
import { task, taskInput, type Task, type TaskInput } from "@nox/types";

/** Statuses a user can toggle a task between from the UI (carried_over is set by the sync/carryover
 *  job, never by hand). */
export type ToggleableStatus = "pending" | "complete";

/**
 * The only module that touches Supabase for tasks. Inputs are validated with Zod before hitting the
 * network and rows are re-parsed on the way back, so nothing untyped crosses this boundary. Errors
 * are surfaced (never swallowed) for the UI to handle. RLS scopes every query to the current user;
 * `user_id` is derived from the authenticated session here (never trusted from the caller) as
 * defense-in-depth. Deletes are soft (tombstone) so removals can propagate to other devices.
 */
export const TaskRepository = {
  /** All of the current user's live (non-deleted) tasks, ordered for stable grouping. */
  async list(): Promise<Task[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("deleted", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return task.array().parse(data ?? []);
  },

  /**
   * Insert a task. The caller supplies the id (a client `newId()`) so the optimistic cache row and
   * the persisted row share an identity. `user_id` comes from the session, not the input.
   */
  async create(input: TaskInput, id: string): Promise<Task> {
    const parsed = taskInput.parse(input);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...parsed, id, user_id: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return task.parse(data);
  },

  /** Patch an existing task's editable fields (used by the detail editor). */
  async update(id: string, patch: Partial<TaskInput>): Promise<Task> {
    const parsed = taskInput.partial().parse(patch);
    const { data, error } = await supabase
      .from("tasks")
      .update(parsed)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return task.parse(data);
  },

  /** Complete / un-complete a task. */
  async setStatus(id: string, status: ToggleableStatus): Promise<Task> {
    const { data, error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return task.parse(data);
  },

  /** Soft-delete (tombstone) so the removal syncs to other devices. */
  async softDelete(id: string): Promise<void> {
    const { error } = await supabase.from("tasks").update({ deleted: true }).eq("id", id);
    if (error) throw error;
  },
};
