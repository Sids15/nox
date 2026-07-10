import { onlineManager, useMutationState } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * Live sync status for the offline / queued-write UI.
 *
 * `queued` counts only writes PAUSED because the network is unreachable — the ones the user has a
 * reason to know about, because they haven't reached the server yet. `pending` additionally counts
 * in-flight writes, which are uninteresting to the user (the optimistic update already shows the
 * result) and last only a few hundred milliseconds. Surface `queued`, not `pending`: keying the UI
 * off `pending` makes the indicator flash on every ordinary tap.
 */
export function useSyncStatus(): { online: boolean; queued: number; pending: number } {
  const online = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
  // One subscription; a paused mutation keeps status "pending", so it's in this set too.
  const pausedFlags = useMutationState({
    filters: { status: "pending" },
    select: (m) => m.state.isPaused,
  });
  return { online, queued: pausedFlags.filter(Boolean).length, pending: pausedFlags.length };
}
