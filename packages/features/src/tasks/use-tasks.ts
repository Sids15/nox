import { TaskRepository, type ToggleableStatus } from "@nox/api";
import { newId } from "@nox/db";
import type { Task, TaskInput } from "@nox/types";
import { addDays as addDaysKey, todayKey } from "@nox/utils";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { usePrefs } from "../prefs/prefs-store";
import { carryoverTaskIds } from "./carryover";
import { groupTasks, type GroupedTasks } from "./group-tasks";
import { shiftReminders, templatesNeedingOccurrence } from "./recurrence";
import { taskKeys } from "./task-keys";

/** Put one task back to how it was in `previous` (or remove it if it wasn't there). */
function restoreOne(qc: QueryClient, previous: Task[], id: string) {
  const before = previous.find((t) => t.id === id);
  qc.setQueryData<Task[]>(taskKeys.all, (cur = []) =>
    before ? cur.map((t) => (t.id === id ? before : t)) : cur.filter((t) => t.id !== id),
  );
}

/** Read the current tasks cache (defaulting to empty) — shared by the optimistic mutations. */
function snapshot(qc: QueryClient): Task[] {
  return qc.getQueryData<Task[]>(taskKeys.all) ?? [];
}

/** All live tasks for the current user (persisted + offline-tolerant via the shared queryClient). */
export function useTasks() {
  return useQuery({ queryKey: taskKeys.all, queryFn: TaskRepository.list });
}

/**
 * Repeating-task occurrences the user deleted, from yesterday on ("originId:YYYY-MM-DD"). Keyed under
 * the tasks key, so it refreshes whenever the task list does (e.g. after a delete).
 */
export function useSkippedOccurrences() {
  return useQuery({
    queryKey: [...taskKeys.all, "skipped"],
    queryFn: () => TaskRepository.skippedOccurrences(addDaysKey(todayKey(), -1)),
    select: (keys) => new Set(keys),
  });
}

/** Tasks split into the sections the Tasks screen renders. Grouping runs in `select` so it only
 *  recomputes when the underlying list changes. */
export function useGroupedTasks() {
  return useQuery<Task[], Error, GroupedTasks>({
    queryKey: taskKeys.all,
    queryFn: TaskRepository.list,
    select: (tasks) => groupTasks(tasks),
  });
}

/**
 * Create a task optimistically. `mutate(input)` generates the id once (via the wrapper below) and
 * threads it through both the optimistic cache row and the repository insert, so the two share
 * identity; on error we roll back to the pre-mutation snapshot.
 */
export function useCreateTask() {
  const qc = useQueryClient();
  const mutation = useMutation<
    Task,
    Error,
    { input: TaskInput; id: string },
    { previous: Task[] }
  >({
    mutationKey: ["task", "create"],
    onMutate: async ({ input, id }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(qc);
      const now = new Date().toISOString();
      const optimistic: Task = {
        id,
        user_id: "",
        created_at: now,
        updated_at: now,
        deleted: false,
        status: "pending",
        sort_order: 0,
        streak_count: 0,
        longest_streak: 0,
        last_completed_on: null,
        origin_task_id: null,
        ...input,
        space_id: input.space_id ?? null,
      };
      qc.setQueryData<Task[]>(taskKeys.all, [...previous, optimistic]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(taskKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });

  // Keep the caller-facing API to `mutate(input)` while generating the shared id internally.
  return {
    ...mutation,
    mutate: (input: TaskInput) => mutation.mutate({ input, id: newId() }),
    mutateAsync: (input: TaskInput) => mutation.mutateAsync({ input, id: newId() }),
    /** Fire an optimistic create and return the new id immediately (so the caller can open the
     *  detail editor — the optimistic row is already in the cache). */
    create: (input: TaskInput): string => {
      const id = newId();
      mutation.mutate({ input, id });
      return id;
    },
  };
}

/** Complete / un-complete a task, updating the cache immediately. */
export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation<Task, Error, { id: string; status: ToggleableStatus }, { previous: Task[] }>({
    mutationKey: ["task", "status"],
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Task[]>(
        taskKeys.all,
        previous.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      return { previous };
    },
    // Undo only this task: a whole-list snapshot would also undo other edits made meanwhile
    // (a drag right after a failed resize used to snap back too).
    onError: (_err, { id }, ctx) => {
      if (ctx) restoreOne(qc, ctx.previous, id);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/** Patch a task's editable fields (used by the detail editor). */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation<Task, Error, { id: string; patch: Partial<TaskInput> }, { previous: Task[] }>({
    mutationKey: ["task", "update"],
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Task[]>(
        taskKeys.all,
        previous.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { previous };
    },
    // Undo only this task: a whole-list snapshot would also undo other edits made meanwhile
    // (a drag right after a failed resize used to snap back too).
    onError: (_err, { id }, ctx) => {
      if (ctx) restoreOne(qc, ctx.previous, id);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/** Soft-delete a task, removing it from the cache immediately. */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string, { previous: Task[] }>({
    mutationKey: ["task", "delete"],
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Task[]>(
        taskKeys.all,
        previous.filter((t) => t.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx) qc.setQueryData(taskKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/**
 * Delete a whole repeating task — the template plus every occurrence generated from it — removing
 * them all from the cache immediately. Pass the TEMPLATE id (an occurrence's `origin_task_id`).
 */
export function useDeleteTaskSeries() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string, { previous: Task[] }>({
    mutationKey: ["task", "delete-series"],
    onMutate: async (templateId: string) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Task[]>(
        taskKeys.all,
        previous.filter((t) => t.id !== templateId && t.origin_task_id !== templateId),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx) qc.setQueryData(taskKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/**
 * Generate-on-demand recurrence. Returns `ensure(focusDate)` — for each repeating template that
 * should have an occurrence on that day but doesn't (see `templatesNeedingOccurrence`), it adds the
 * occurrence to the cache optimistically and materializes it via the repository. Idempotent + quiet.
 */
export function useEnsureOccurrences() {
  const qc = useQueryClient();
  return useCallback(
    async (focusDate: string) => {
      const tasks = qc.getQueryData<Task[]>(taskKeys.all) ?? [];
      const templates = templatesNeedingOccurrence(tasks, focusDate);
      if (templates.length === 0) return;

      // Materialize on the server first (no optimistic add): a deleted occurrence leaves a soft-
      // delete tombstone that keeps its (origin, due_date) slot, so createOccurrence returns null
      // and the refetch won't resurrect it. Then invalidate to pull in the new occurrences.
      let anyCreated = false;
      await Promise.all(
        templates.map((template) =>
          TaskRepository.createOccurrence(
            template,
            focusDate,
            newId(),
            // templatesNeedingOccurrence only returns dated templates; the fallback is for the types.
            shiftReminders(template.reminder_times, template.due_date ?? focusDate, focusDate),
          )
            .then((row) => {
              if (row) anyCreated = true;
            })
            .catch(() => null),
        ),
      );
      if (anyCreated) qc.invalidateQueries({ queryKey: taskKeys.all });
    },
    [qc],
  );
}

/**
 * Daily carryover. Returns `run()` — once per calendar day (gated by `usePrefs.lastCarryoverOn`),
 * moves overdue standalone tasks to today as `carried_over`. Waits until the tasks query has loaded
 * so it never marks the day done against an empty cache.
 */
export function useRunCarryover() {
  const qc = useQueryClient();
  const lastCarryoverOn = usePrefs((s) => s.lastCarryoverOn);
  const setLastCarryover = usePrefs((s) => s.setLastCarryover);
  // The Tasks screen re-triggers this whenever the list length changes; one run at a time.
  const running = useRef(false);
  return useCallback(async () => {
    const today = todayKey();
    if (lastCarryoverOn === today || running.current) return;
    if (qc.getQueryState(taskKeys.all)?.status !== "success") return; // tasks not loaded yet

    const tasks = qc.getQueryData<Task[]>(taskKeys.all) ?? [];
    const ids = carryoverTaskIds(tasks, today);
    if (ids.length === 0) {
      setLastCarryover(today);
      return;
    }

    running.current = true;
    const idSet = new Set(ids);
    qc.setQueryData<Task[]>(
      taskKeys.all,
      tasks.map((t) =>
        idSet.has(t.id) ? { ...t, status: "carried_over", due_date: today } : t,
      ),
    );
    try {
      await TaskRepository.carryOver(ids, today);
      // Only now is the day done. Marking it before the write (as this used to) meant a failed
      // write — offline at launch, an expired token — was never retried: the refetch below put the
      // tasks back as overdue and the gate stayed shut until tomorrow.
      setLastCarryover(today);
    } catch (e) {
      console.warn("[tasks] carryover failed; it will retry on the next load:", e);
    } finally {
      running.current = false;
      void qc.invalidateQueries({ queryKey: taskKeys.all });
    }
  }, [qc, lastCarryoverOn, setLastCarryover]);
}
