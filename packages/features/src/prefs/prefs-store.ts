import AsyncStorage from "@react-native-async-storage/async-storage";
import { accents, DEFAULT_ACCENT, type AccentName, type ThemeName } from "@nox/ui";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type NotifKey = "morningSummary" | "endOfDayPrompt" | "taskReminders";

/** How the Tasks calendar looks. Every field is the user's to change from the calendar's settings. */
export interface CalendarPrefs {
  /** Tasks opens as a list, or the calendar's day or week. */
  view: "list" | "day" | "week";
  /** First and last hour drawn on the grid (0–24). */
  startHour: number;
  endHour: number;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1;
  showWeekends: boolean;
  showCompleted: boolean;
  density: "compact" | "comfortable";
  /** When adding a task with a day but no time (or no length), ask once before saving it. */
  askWhenAdding: boolean;
}

/** The typeface for titles and headings: the system sans, a lighter modern serif, or the classic serif. */
export type HeadingFont = "sans" | "modern" | "classic";

export const DEFAULT_CALENDAR: CalendarPrefs = {
  view: "list",
  startHour: 7,
  endHour: 22,
  weekStartsOn: 1,
  showWeekends: true,
  showCompleted: true,
  density: "comfortable",
  askWhenAdding: true,
};

interface PrefsState {
  theme: ThemeName;
  accent: AccentName;
  morningSummary: boolean;
  endOfDayPrompt: boolean;
  taskReminders: boolean;
  /** Date key (YYYY-MM-DD) the daily carryover job last ran for — gates it to once per day. */
  lastCarryoverOn: string | null;
  /** Onboarding finished on this device (the account also records it — see useOnboarded). */
  onboarded: boolean;
  calendar: CalendarPrefs;
  setCalendar: (patch: Partial<CalendarPrefs>) => void;
  headingFont: HeadingFont;
  setHeadingFont: (f: HeadingFont) => void;
  /** Nox AI features (planning, task entry, note help…). Off = no AI buttons and nothing is sent. */
  aiEnabled: boolean;
  setAiEnabled: (v: boolean) => void;
  /** True once the persisted prefs have loaded — used to avoid a theme flash at startup. */
  hydrated: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  setAccent: (accent: AccentName) => void;
  setNotif: (key: NotifKey, value: boolean) => void;
  setLastCarryover: (dateKey: string) => void;
  setHydrated: () => void;
  setOnboarded: (v: boolean) => void;
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
      onboarded: false,
      calendar: DEFAULT_CALENDAR,
      setCalendar: (patch) => set((s) => ({ calendar: { ...s.calendar, ...patch } })),
      headingFont: "sans",
      setHeadingFont: (headingFont) => set({ headingFont }),
      aiEnabled: true,
      setAiEnabled: (aiEnabled) => set({ aiEnabled }),
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setAccent: (accent) => set({ accent }),
      setNotif: (key, value) => set({ [key]: value } as Pick<PrefsState, NotifKey>),
      setLastCarryover: (dateKey) => set({ lastCarryoverOn: dateKey }),
      setHydrated: () => set({ hydrated: true }),
      setOnboarded: (onboarded) => set({ onboarded }),
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
        s.calendar = { ...DEFAULT_CALENDAR, ...(s.calendar ?? {}) };
        return s as PrefsState;
      },
      // Fill in calendar settings added after the stored copy was written.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PrefsState>;
        return { ...current, ...p, calendar: { ...DEFAULT_CALENDAR, ...(p.calendar ?? {}) } };
      },
      partialize: (s) => ({
        theme: s.theme,
        accent: s.accent,
        morningSummary: s.morningSummary,
        endOfDayPrompt: s.endOfDayPrompt,
        taskReminders: s.taskReminders,
        lastCarryoverOn: s.lastCarryoverOn,
        onboarded: s.onboarded,
        calendar: s.calendar,
        headingFont: s.headingFont,
        aiEnabled: s.aiEnabled,
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
