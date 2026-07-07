import { onlineManager, useMutationState } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * Live sync status for the offline / pending-write UI: whether the device is online (via
 * `onlineManager`, wired to real connectivity in setupOnlineManager) and how many writes are
 * currently in flight or paused-while-offline. Drives the desktop status chip and the mobile banner.
 */
export function useSyncStatus(): { online: boolean; pending: number } {
  const online = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
  // A queued (paused) write and an in-flight write both sit in `pending`.
  const pending = useMutationState({ filters: { status: "pending" } }).length;
  return { online, pending };
}
