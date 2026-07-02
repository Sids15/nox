import { TaskRepository, type ToggleableStatus } from "@nox/api";
import { newId } from "@nox/db";
import type { Task, TaskInput } from "@nox/types";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { groupTasks, type GroupedTasks } from "./group-tasks";
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
