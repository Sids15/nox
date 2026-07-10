import type { AlertButton } from "react-native";
import { create } from "zustand";

/**
 * Web-only alert queue. `Alert.alert()` is a fire-and-forget call from anywhere — including plain
 * functions outside the React tree — so the request goes into this store and `DialogHost` (mounted
 * once at the root) renders it. Only `alert.web.ts` and `dialog-host.web.tsx` import this, so it
 * never reaches the native bundle.
 *
 * Requests queue rather than replace: two validation failures in quick succession should both be
 * seen, not silently collapse into the last one.
 */
export interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface AlertQueueState {
  queue: AlertRequest[];
  push: (req: Omit<AlertRequest, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 0;

export const useAlertQueue = create<AlertQueueState>()((set) => ({
  queue: [],
  push: (req) => set((s) => ({ queue: [...s.queue, { ...req, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((r) => r.id !== id) })),
}));

export function pushAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  useAlertQueue.getState().push({
    title,
    message,
    // RN shows a lone "OK" when no buttons are given; match that so an informational alert is dismissible.
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
  });
}
