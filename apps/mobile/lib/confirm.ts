import { Alert } from "./alert";

/**
 * Ask before a delete. One shape for every destructive action — Cancel plus a red confirm — so they
 * read the same everywhere; on web/desktop Alert renders the themed in-app dialog.
 */
export function confirmDelete({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}): void {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

/** "2 notes" / "1 note". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
