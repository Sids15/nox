import { TaskRepository, type ToggleableStatus } from "@nox/api";
import { newId } from "@nox/db";
import type { Task, TaskInput } from "@nox/types";
import { todayKey } from "@nox/utils";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { usePrefs } from "../prefs/prefs-store";
import { carryoverTaskIds } from "./carryover";
import { groupTasks, type GroupedTasks } from "./group-tasks";
import { templatesNeedingOccurrence } from "./recurrence";
import { taskKeys } from "./task-keys";

/** Read the current tasks cache (defaulting to empty) — shared by the optimistic mutations. */
function snapshot(qc: QueryClient): Task[] {
  return qc.getQueryData<Task[]>(taskKeys.all) ?? [];
}

/** All live tasks for the current user (persisted + offline-tolerant via the shared queryClient). */
export function useTasks() {
  return useQuery({ queryKey: taskKeys.all, queryFn: TaskRepository.list });
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
    mutationFn: ({ input, id }) => TaskRepository.create(input, id),
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
  };
}

/** Complete / un-complete a task, updating the cache immediately. */
export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ToggleableStatus }) =>
      TaskRepository.setStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Task[]>(
        taskKeys.all,
        previous.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(taskKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/** Patch a task's editable fields (used by the detail editor). */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TaskInput> }) =>
      TaskRepository.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(qc);
      qc.setQueryData<Task[]>(
        taskKeys.all,
        previous.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(taskKeys.all, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/** Soft-delete a task, removing it from the cache immediately. */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => TaskRepository.softDelete(id),
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

      const now = new Date().toISOString();
      const created = templates.map((template) => ({ template, id: newId() }));
      const optimistic: Task[] = created.map(({ template, id }) => ({
        ...template,
        id,
        origin_task_id: template.id,
        due_date: focusDate,
        repeat: "none",
        repeat_config: null,
        status: "pending",
        created_at: now,
        updated_at: now,
      }));
      qc.setQueryData<Task[]>(taskKeys.all, [...tasks, ...optimistic]);

      await Promise.all(
        created.map(({ template, id }) =>
          TaskRepository.createOccurrence(template, focusDate, id).catch(() => null),
        ),
      );
      qc.invalidateQueries({ queryKey: taskKeys.all });
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
  return useCallback(async () => {
    const today = todayKey();
    if (lastCarryoverOn === today) return;
    if (qc.getQueryState(taskKeys.all)?.status !== "success") return; // tasks not loaded yet

    const tasks = qc.getQueryData<Task[]>(taskKeys.all) ?? [];
    const ids = carryoverTaskIds(tasks, today);
    setLastCarryover(today);
    if (ids.length === 0) return;

    const idSet = new Set(ids);
    qc.setQueryData<Task[]>(
      taskKeys.all,
      tasks.map((t) =>
        idSet.has(t.id) ? { ...t, status: "carried_over", due_date: today } : t,
      ),
    );
    await TaskRepository.carryOver(ids, today).catch(() => {});
    qc.invalidateQueries({ queryKey: taskKeys.all });
  }, [qc, lastCarryoverOn, setLastCarryover]);
}
