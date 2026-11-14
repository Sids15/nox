import {
  nextOccurrenceDate,
  shiftReminders,
  useDeleteTask,
  useDeleteTaskSeries,
  useTasks,
  useToggleTask,
  useUpdateTask,
} from "@nox/features";
import type { Task } from "@nox/types";
import { relativeDayLabel } from "@nox/utils";
import { useCallback } from "react";

import { Alert } from "./alert";
import { confirmDelete } from "./confirm";

/** A repeating task is either the template (it carries the rule) or a day generated from one. */
export function isRepeating(task: Task): boolean {
  return task.repeat !== "none" || task.origin_task_id !== null;
}

/**
 * The one delete path for tasks — the swipe action and the editor menu both go through it.
 *
 * Every delete asks first. A one-off task gets a plain confirm. A repeating task gets a choice,
 * because "delete" is ambiguous there and the old behaviour picked the surprising answer silently:
 * it removed only the day you swiped, and the task was back the next morning. The two choices:
 *
 * - **This day only** — a generated day is tombstoned (its slot stays taken, so it is not
 *   regenerated). The template itself only ever shows on its anchor day, so skipping THAT day moves
 *   the anchor (and its reminders) to the next day the rule produces; the repeat carries on.
 * - **Every day** — the template and every day generated from it are deleted together.
 *
 * `onDeleted` runs only if something was actually deleted (not on Cancel) — the editor uses it to
 * close itself.
 */
export function useTaskDelete(): (task: Task, onDeleted?: () => void) => void {
  const { data: tasks = [] } = useTasks();
  const deleteTask = useDeleteTask();
  const deleteSeries = useDeleteTaskSeries();
  const updateTask = useUpdateTask();
  const toggleTask = useToggleTask();

  return useCallback(
    (task, onDeleted) => {
      if (!isRepeating(task)) {
        confirmDelete({
          title: "Delete task?",
          message: `“${task.title}” will be deleted on all your devices.`,
          onConfirm: () => {
            deleteTask.mutate(task.id);
            onDeleted?.();
          },
        });
        return;
      }

      const templateId = task.origin_task_id ?? task.id;

      const skipThisDay = () => {
        if (task.origin_task_id !== null) {
          deleteTask.mutate(task.id);
          return;
        }
        const next = nextOccurrenceDate(task, tasks);
        if (next === null || task.due_date === null) {
          // No later day to move to — this day is all that is left of the task.
          deleteSeries.mutate(templateId);
          return;
        }
        updateTask.mutate({
          id: task.id,
          patch: { due_date: next, reminder_times: shiftReminders(task.reminder_times, task.due_date, next) },
        });
        // The checkmark belonged to the day being removed, not to the day the task moves to.
        if (task.status === "complete") toggleTask.mutate({ id: task.id, status: "pending" });
      };

      const day = task.due_date ? relativeDayLabel(task.due_date) : "this day";
      Alert.alert(
        "Delete repeating task?",
        `“${task.title}” repeats. Delete only this one (${day}), or the whole task on every day?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "This day only",
            onPress: () => {
              skipThisDay();
              onDeleted?.();
            },
          },
          {
            text: "Every day",
            style: "destructive",
            onPress: () => {
              deleteSeries.mutate(templateId);
              onDeleted?.();
            },
          },
        ],
      );
    },
    [tasks, deleteTask, deleteSeries, updateTask, toggleTask],
  );
}
