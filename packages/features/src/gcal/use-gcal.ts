import { GcalRepository } from "@nox/api";
import type { GoogleEvent } from "@nox/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { taskKeys } from "../tasks/task-keys";
import { useTasks } from "../tasks/use-tasks";

export const gcalKeys = { status: ["gcal", "status"] as const, range: (from: string, to: string) => ["gcal", "events", from, to] as const };

/** Whether Google Calendar is connected (null: not; undefined: not set up on this database). */
export function useGcalStatus() {
  return useQuery({ queryKey: gcalKeys.status, queryFn: GcalRepository.status, staleTime: 60_000 });
}

/**
 * Google events between two days, after a two-way sync. Re-syncs every few minutes, and a few
 * seconds after your tasks change (so a moved task reaches Google). When the sync changed tasks
 * (something moved in Google), the task list is refreshed.
 */
export function useGoogleEvents(from: string, to: string): GoogleEvent[] {
  const qc = useQueryClient();
  const { data: status } = useGcalStatus();
  const on = !!status;
  const q = useQuery({
    queryKey: gcalKeys.range(from, to),
    enabled: on,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const r = await GcalRepository.sync(from, to);
      if (r.changed) void qc.invalidateQueries({ queryKey: taskKeys.all });
      if (!r.connected) void qc.invalidateQueries({ queryKey: gcalKeys.status });
      return r.events;
    },
  });

  // Your edits reach Google a few seconds after you make them.
  const { dataUpdatedAt } = useTasks();
  const first = useRef(true);
  useEffect(() => {
    if (!on) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => void qc.invalidateQueries({ queryKey: ["gcal", "events"] }), 4000);
    return () => clearTimeout(t);
  }, [dataUpdatedAt, on, qc]);

  return q.data ?? [];
}
