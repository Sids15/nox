import { buildWidgetSnapshot, useIdeas, useNotes, usePrefs, useSpaces, useTasks, type WidgetSnapshot } from "@nox/features";
import { toDateKey } from "@nox/utils";
import { useMemo } from "react";
import { useClock } from "../../lib/use-clock";

/** What the widget shows right now, from the app's live data and the widget settings. */
export function useWidgetSnapshot(): WidgetSnapshot {
  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: ideas = [] } = useIdeas();
  const { data: spaces = [] } = useSpaces();
  const config = usePrefs((s) => s.widget);
  const now = useClock();
  const today = toDateKey(now);
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return useMemo(
    () => buildWidgetSnapshot({ tasks, notes, ideas, spaces, config }, today, hhmm),
    [tasks, notes, ideas, spaces, config, today, hhmm],
  );
}
