import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AccentName, ThemeName } from "@nox/ui";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type NotifKey = "morningSummary" | "endOfDayPrompt" | "taskReminders";

interface PrefsState {
  theme: ThemeName;
  accent: AccentName;
  morningSummary: boolean;
  endOfDayPrompt: boolean;
  taskReminders: boolean;
  /** True once the persisted prefs have loaded — used to avoid a theme flash at startup. */
  hydrated: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  setAccent: (accent: AccentName) => void;
  setNotif: (key: NotifKey, value: boolean) => void;
  setHydrated: () => void;
}

/**
 * User preferences (theme, accent, notification toggles), persisted to AsyncStorage. Defaults match
 * the handoff Settings screen: dark + violet, morning/EOD summaries on, task reminders off. Notif
 * toggles are persisted now; actual scheduling is wired later (needs a dev build).
 */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: "dark",
      accent: "violet",
      morningSummary: true,
      endOfDayPrompt: true,
      taskReminders: false,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setAccent: (accent) => set({ accent }),
      setNotif: (key, value) => set({ [key]: value } as Pick<PrefsState, NotifKey>),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "nox:prefs",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        theme: s.theme,
        accent: s.accent,
        morningSummary: s.morningSummary,
        endOfDayPrompt: s.endOfDayPrompt,
        taskReminders: s.taskReminders,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
