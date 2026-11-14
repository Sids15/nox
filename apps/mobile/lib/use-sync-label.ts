import { useSyncStatus, useThemeColors } from "@nox/features";

export interface SyncLabel {
  /** Short state word for a status row: "Synced", "Syncing", "Offline". */
  title: string;
  /** Secondary detail, e.g. "3 changes queued"; null when there is nothing to add. */
  detail: string | null;
  color: string;
  /** Only the settled state gets the breathing dot — a pulse on "Offline" would read as activity. */
  settled: boolean;
}

/**
 * The one place that turns sync state into words and a colour, so the sidebar and Settings can never
 * disagree. Both used to print a hard-coded green "Synced" even with the device offline and edits
 * waiting to upload.
 */
export function useSyncLabel(): SyncLabel {
  const { online, queued } = useSyncStatus();
  const c = useThemeColors();
  const changes = `${queued} change${queued === 1 ? "" : "s"}`;

  if (!online) {
    return { title: "Offline", detail: queued > 0 ? `${changes} queued` : "edits sync on reconnect", color: c.ink3, settled: false };
  }
  if (queued > 0) return { title: "Syncing", detail: changes, color: c.accent, settled: false };
  return { title: "Synced", detail: null, color: c.success, settled: true };
}
