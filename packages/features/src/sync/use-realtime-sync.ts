import { supabase } from "@nox/db";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSessionStore } from "../auth/session-store";

/** Every synced table; its name is also the query-key head (e.g. `["tasks"]`). */
const SYNCED_TABLES = ["tasks", "ideas", "notes", "folders", "resources", "tags", "spaces", "templates", "focus_sessions"] as const;

/**
 * Keeps every module live across devices. Opens one Supabase Realtime `postgres_changes`
 * subscription per table, **filtered to the current user** (never a wildcard — see rules.md), and
 * invalidates the matching query key on any INSERT/UPDATE/DELETE so TanStack Query refetches. Inert
 * until authenticated; realtime auth rides the session token, so RLS + the filter both scope what
 * this client receives. Call once at the app root.
 */
export function useRealtimeSync(): void {
  const qc = useQueryClient();
  const userId = useSessionStore((s) => s.session?.user.id ?? null);

  useEffect(() => {
    if (!userId) return;

    // Throttle bursty changes to one refetch per table per ~250ms.
    const timers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
    const invalidate = (table: string) => {
      if (timers[table]) return;
      timers[table] = setTimeout(() => {
        timers[table] = undefined;
        qc.invalidateQueries({ queryKey: [table] });
      }, 250);
    };

    const channels = SYNCED_TABLES.map((table) =>
      supabase
        .channel(`rt:${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
          () => invalidate(table),
        )
        .subscribe(),
    );

    return () => {
      Object.values(timers).forEach((t) => t && clearTimeout(t));
      channels.forEach((ch) => {
        void supabase.removeChannel(ch);
      });
    };
  }, [userId, qc]);
}
