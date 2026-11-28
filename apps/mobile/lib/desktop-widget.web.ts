import { isTauri } from "@nox/db";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { router } from "expo-router";
import { useEffect } from "react";

/**
 * The desktop widget is a second, small Tauri window running this same app with `?view=widget`
 * (see `toggle_widget` in the Rust shell). It shares the session, data and settings with the main
 * window; opening something from it shows the main window there.
 */
export const isWidgetWindow = (): boolean =>
  isTauri() && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "widget";

export const canOpenDesktopWidget = (): boolean => isTauri() && !isWidgetWindow();

/** Show the widget (creating it the first time), or hide it if it's showing. */
export async function toggleDesktopWidget(): Promise<void> {
  if (!isTauri()) return;
  await invoke("toggle_widget").catch(() => {});
}

export async function setWidgetAlwaysOnTop(on: boolean): Promise<void> {
  if (!isWidgetWindow()) return;
  await getCurrentWindow().setAlwaysOnTop(on).catch(() => {});
}

export async function hideWidgetWindow(): Promise<void> {
  if (!isWidgetWindow()) return;
  await getCurrentWindow().hide().catch(() => {});
}

const OPEN_EVENT = "nox-open-in-main";

/** From the widget: bring the main window forward at `path` (a task, a note, a space…). */
export async function openInMainWindow(path: string): Promise<void> {
  await emit(OPEN_EVENT, path).catch(() => {});
  await invoke("show_main").catch(() => {});
}

/** In the main window: go where the widget asked. Only in-app paths are accepted. */
export function useOpenFromWidget(): void {
  useEffect(() => {
    if (!isTauri() || isWidgetWindow()) return;
    let stop: (() => void) | undefined;
    void listen<string>(OPEN_EVENT, (e) => {
      const path = typeof e.payload === "string" ? e.payload : "";
      if (/^\/(task|note|idea|space)\/[0-9a-f-]{36}$/i.test(path) || /^\/\(tabs\)(\/[a-z]+)?$/.test(path) || /^\/add(\?space=[0-9a-f-]{36})?$/i.test(path)) router.push(path as never);
    }).then((fn) => (stop = fn));
    return () => stop?.();
  }, []);
}
