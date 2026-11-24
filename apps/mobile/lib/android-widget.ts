import { usePrefs, useThemeColors } from "@nox/features";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { NoxWidget } from "../modules/nox-widget";
import { useWidgetSnapshot } from "../components/widget/use-widget-snapshot";

/**
 * Keeps the Android home-screen widget current: whenever what it would show changes (a task ticked,
 * a setting changed, the theme switched), the new snapshot is handed to the widget. Debounced, and
 * skipped when nothing changed. Mounted only while signed in.
 */
export function useAndroidWidgetSync(): void {
  const snapshot = useWidgetSnapshot();
  const theme = usePrefs((s) => s.theme);
  const c = useThemeColors();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android" || !NoxWidget) return;
    // generatedAt changes every render; leave it out of the "did anything change" comparison.
    const { generatedAt: _g, ...stable } = snapshot;
    const key = JSON.stringify({ stable, theme, ink: c.ink, ink3: c.ink3, accent: c.accent });
    if (key === last.current) return;
    const t = setTimeout(() => {
      last.current = key;
      try {
        NoxWidget?.setSnapshot(JSON.stringify({ ...snapshot, theme, colors: { ink: c.ink, ink3: c.ink3, accent: c.accent } }));
      } catch {
        // A widget that can't update keeps its last picture; never break the app over it.
      }
    }, 800);
    return () => clearTimeout(t);
  }, [snapshot, theme, c.ink, c.ink3, c.accent]);
}

/** Signed out: the widget forgets the last account's tasks. */
export function clearAndroidWidget(): void {
  if (Platform.OS !== "android" || !NoxWidget) return;
  try {
    NoxWidget.clear();
  } catch {
    // nothing to clear
  }
}
