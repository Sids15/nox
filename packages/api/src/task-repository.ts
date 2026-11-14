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
   * Occurrences of repeating tasks that were deleted on or after `fromDate`, as "originId:YYYY-MM-DD"
   * keys. `list` leaves deleted rows out, but a calendar projecting repeats onto future days needs to
   * know which ones the user removed, or it would draw them again.
   */
  async skippedOccurrences(fromDate: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("origin_task_id,due_date")
      .eq("deleted", true)
      .not("origin_task_id", "is", null)
      .gte("due_date", fromDate);
    if (error) throw error;
    return (data ?? [])
      .filter((r): r is { origin_task_id: string; due_date: string } => !!r.origin_task_id && !!r.due_date)
      .map((r) => `${r.origin_task_id}:${r.due_date}`);
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

  /**
   * Soft-delete a whole repeating task: the template and every occurrence generated from it, in one
   * statement. Deleting only the template would stop future days but leave the already-generated
   * ones behind. The id is validated as a UUID before it is interpolated into the filter.
   */
  async softDeleteSeries(templateId: string): Promise<void> {
    const id = task.shape.id.parse(templateId);
    const { error } = await supabase
      .from("tasks")
      .update({ deleted: true })
      .or(`id.eq.${id},origin_task_id.eq.${id}`);
    if (error) throw error;
  },

  /**
   * Materialize a recurring template's occurrence for `dueDate` (generate-on-demand). Copies the
   * template's editable fields, links back via `origin_task_id`, and is a plain (non-repeating) task.
   * `reminderTimes` are the template's reminders already moved onto `dueDate` by the caller — the
   * template's own are timestamps on its anchor day and would be in the past here.
   * Returns null on a unique-violation (23505) — the `(origin_task_id, due_date)` index is the race
   * backstop when two devices generate the same occurrence.
   */
  async createOccurrence(
    template: Task,
    dueDate: string,
    id: string,
    reminderTimes: string[],
  ): Promise<Task | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        id,
        user_id: session.user.id,
        title: template.title,
        notes: template.notes,
        due_date: dueDate,
        due_time: template.due_time,
        reminder_times: reminderTimes,
        priority: template.priority,
        status: "pending",
        repeat: "none",
        repeat_config: null,
        origin_task_id: template.id,
        sort_order: template.sort_order,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return null; // occurrence already exists
      throw error;
    }
    return task.parse(data);
  },

  /** Move overdue standalone tasks to today as carried-over (one bulk update). */
  async carryOver(ids: string[], today: string): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("tasks")
      .update({ status: "carried_over", due_date: today })
      .in("id", ids);
    if (error) throw error;
  },
};
