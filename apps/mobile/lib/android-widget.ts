import { usePrefs, useThemeColors } from "@nox/features";
import { router } from "expo-router";
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

/**
 * "Share to Nox" on Android: text or a link shared from another app opens "Add to Nox" with it
 * filled in — on a cold start (once signed in) and while the app is already open.
 */
export function useAndroidShare(signedIn: boolean): void {
  useEffect(() => {
    if (Platform.OS !== "android" || !signedIn || !NoxWidget?.takeSharedText) return;
    const open = (text: string) => router.push({ pathname: "/add", params: { text } });
    // Let the first screen settle before opening the sheet over it.
    const t = setTimeout(() => {
      const text = NoxWidget?.takeSharedText?.();
      if (text) open(text);
    }, 400);
    const sub = NoxWidget.addListener?.("onShare", () => {
      const text = NoxWidget?.takeSharedText?.();
      if (text) open(text);
    });
    return () => {
      clearTimeout(t);
      sub?.remove();
    };
  }, [signedIn]);
}
