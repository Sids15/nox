import { parseQuickAdd, useCreateTask, usePrefs, useThemeColors, useToggleTask } from "@nox/features";
import { toDateKey } from "@nox/utils";
import { AppWindow, Pin, PinOff, X } from "lucide-react-native";
import { useEffect } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { hideWidgetWindow, openInMainWindow, setWidgetAlwaysOnTop } from "../../lib/desktop-widget";
import { clockLabel, useClock } from "../../lib/use-clock";
import { useWidgetSnapshot } from "./use-widget-snapshot";
import { WidgetView } from "./widget-view";

/**
 * The desktop widget window: a small frameless panel with today's tasks and whatever else is picked
 * in Settings → Widget. Drag it by the top bar; pin keeps it above other windows.
 */
export function DesktopWidget() {
  const c = useThemeColors();
  const snapshot = useWidgetSnapshot();
  const toggle = useToggleTask();
  const createTask = useCreateTask();
  const onTop = usePrefs((s) => s.widget.alwaysOnTop);
  const setWidget = usePrefs((s) => s.setWidget);
  const now = useClock();

  useEffect(() => {
    void setWidgetAlwaysOnTop(onTop);
  }, [onTop]);

  // Settings changed in the main window reach this one through shared storage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = () => void usePrefs.persist.rehydrate();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const drag = { dataSet: { tauriDragRegion: "" } } as object;

  return (
    <View className="bg-bg border-line flex-1 overflow-hidden border">
      <View {...drag} className="border-line flex-row items-center gap-2 border-b px-3 py-2" style={{ cursor: "grab" } as object}>
        <Image source={require("../../assets/nox-wordmark.png")} style={{ width: 34, height: 18, tintColor: c.ink, pointerEvents: "none" } as object} resizeMode="contain" />
        <Text {...drag} className="text-ink-3 flex-1 text-[12px]">
          {clockLabel(now)}
        </Text>
        <Pressable onPress={() => setWidget({ alwaysOnTop: !onTop })} hitSlop={6} accessibilityLabel={onTop ? "Stop keeping on top" : "Keep on top"} {...({ title: onTop ? "Pinned on top" : "Keep on top" } as object)} className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]">
          {onTop ? <Pin size={13} color={c.accent} strokeWidth={2.2} /> : <PinOff size={13} color={c.ink3} strokeWidth={2.2} />}
        </Pressable>
        <Pressable onPress={() => void openInMainWindow("/(tabs)/tasks")} hitSlop={6} accessibilityLabel="Open Nox" {...({ title: "Open Nox" } as object)} className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]">
          <AppWindow size={13} color={c.ink2} strokeWidth={2.2} />
        </Pressable>
        <Pressable onPress={() => void hideWidgetWindow()} hitSlop={6} accessibilityLabel="Hide widget" {...({ title: "Hide widget" } as object)} className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]">
          <X size={13} color={c.ink3} strokeWidth={2.2} />
        </Pressable>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <WidgetView
          snapshot={snapshot}
          actions={{
            onToggleTask: (id, done) => toggle.mutate({ id, status: done ? "complete" : "pending" }),
            onOpen: (path) => void openInMainWindow(path),
            onCapture: (raw) => {
              // The same quick-add parsing as the app: "call mum 6pm" gets its time.
              const p = parseQuickAdd(raw, toDateKey(new Date()));
              createTask.create({
                title: (p.title || raw).slice(0, 200),
                notes: null,
                due_date: p.date ?? toDateKey(new Date()),
                due_time: p.time ?? (p.tonight ? "20:00" : null),
                ...(p.duration ? { duration_minutes: p.duration } : {}),
                reminder_times: [],
                priority: p.priority ?? "medium",
                repeat: "none",
                repeat_config: null,
              });
            },
          }}
        />
      </ScrollView>
    </View>
  );
}
