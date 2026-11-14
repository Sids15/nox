import AsyncStorage from "@react-native-async-storage/async-storage";
import { accents, DEFAULT_ACCENT, type AccentName, type ThemeName } from "@nox/ui";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type NotifKey = "morningSummary" | "endOfDayPrompt" | "taskReminders";

interface PrefsState {
  theme: ThemeName;
  accent: AccentName;
  morningSummary: boolean;
  endOfDayPrompt: boolean;
  taskReminders: boolean;
  /** Date key (YYYY-MM-DD) the daily carryover job last ran for — gates it to once per day. */
  lastCarryoverOn: string | null;
  /** True once the persisted prefs have loaded — used to avoid a theme flash at startup. */
  hydrated: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  setAccent: (accent: AccentName) => void;
  setNotif: (key: NotifKey, value: boolean) => void;
  setLastCarryover: (dateKey: string) => void;
  setHydrated: () => void;
}

/**
 * User preferences (theme, accent, notification toggles), persisted to AsyncStorage. Defaults match
 * Ink & Paper: light + vermilion, morning/EOD summaries on, task reminders on. The
 * toggles drive local notification scheduling (apps/mobile/lib/use-notifications.ts); delivery is
 * verified in a dev build (Expo Go dropped notification support in SDK 53+).
 */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: "light",
      accent: DEFAULT_ACCENT,
      morningSummary: true,
      endOfDayPrompt: true,
      taskReminders: true,
      lastCarryoverOn: null,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setAccent: (accent) => set({ accent }),
      setNotif: (key, value) => set({ [key]: value } as Pick<PrefsState, NotifKey>),
      setLastCarryover: (dateKey) => set({ lastCarryoverOn: dateKey }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "nox:prefs",
      storage: createJSONStorage(() => AsyncStorage),
      // v1 = the Ink & Paper redesign. The old accents (violet/green/coral/blue) no longer exist:
      // map each to its nearest new one, and move everyone onto the new light default once.
      version: 1,
      migrate: (persisted, from) => {
        const s = (persisted ?? {}) as Partial<PrefsState> & { accent?: string };
        if (from < 1) {
          const map: Record<string, AccentName> = { violet: "indigo", blue: "indigo", green: "moss", coral: "vermilion" };
          s.accent = map[s.accent ?? ""] ?? DEFAULT_ACCENT;
          s.theme = "light";
        }
        if (!s.accent || !(s.accent in accents)) s.accent = DEFAULT_ACCENT;
        return s as PrefsState;
      },
      partialize: (s) => ({
        theme: s.theme,
        accent: s.accent,
        morningSummary: s.morningSummary,
        endOfDayPrompt: s.endOfDayPrompt,
        taskReminders: s.taskReminders,
        lastCarryoverOn: s.lastCarryoverOn,
      }),
      // Zustand calls this as (hydratedState, error). On a storage failure `state` is undefined, and
      // the old `state?.setHydrated()` left `hydrated` false forever — the root layout gates first
      // paint on that flag, so a broken store hung the app on its spinner instead of falling back to
      // the default theme. Always mark hydrated; surface the failure rather than swallowing it.
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn("[prefs] rehydrate failed; using defaults:", error);
        (state ?? usePrefs.getState()).setHydrated();
      },
    },
  ),
);
