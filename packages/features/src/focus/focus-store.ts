import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FocusTimer } from "./timer";

interface FocusStore {
  /** The running (or paused, or finished but not yet logged) timer on this device. */
  timer: FocusTimer | null;
  setTimer: (timer: FocusTimer | null) => void;
}

/** The focus timer, kept on the device so it outlives the page and an app restart. */
export const useFocusStore = create<FocusStore>()(
  persist(
    (set) => ({
      timer: null,
      setTimer: (timer) => set({ timer }),
    }),
    { name: "nox:focus", storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);
