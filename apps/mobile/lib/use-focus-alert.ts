import { endsAt, useFocusStore, useTasks } from "@nox/features";
import { useEffect } from "react";
import { setFocusAlert } from "./focus-alert";

/** Keeps the "Focus done" alert in step with the timer, wherever you are in the app. Mount once. */
export function useFocusAlert(enabled: boolean): void {
  const timer = useFocusStore((s) => s.timer);
  const { data: tasks = [] } = useTasks();
  const title = timer?.taskId ? tasks.find((t) => t.id === timer.taskId)?.title : null;

  useEffect(() => {
    if (!enabled || !timer) {
      void setFocusAlert(null, "");
      return;
    }
    const at = endsAt(timer, Date.now());
    void setFocusAlert(at, title ? `Time's up on “${title}”.` : "Time's up. Take a break.");
  }, [enabled, timer, title]);
}
