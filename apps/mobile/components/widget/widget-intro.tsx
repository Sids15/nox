import { useThemeColors, useThemeVars } from "@nox/features";
import { ArrowRight, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { canOpenDesktopWidget } from "../../lib/desktop-widget";

/** A drawn widget, for the walkthroughs: today's tasks, what's next, and a space's pipeline. */
export function WidgetArt({ highlight }: { highlight?: "sections" | "where" }) {
  const c = useThemeColors();
  const row = (done: boolean, t: string, time?: string) => (
    <View key={t} className="flex-row items-center gap-1.5 py-[3px]">
      <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderColor: done ? c.accent : c.ink3, backgroundColor: done ? c.accent : "transparent" }} />
      <Text className={`flex-1 text-[11px] ${done ? "text-ink-3 line-through" : "text-ink"}`}>{t}</Text>
      {time ? <Text className="text-ink-3 text-[10px]">{time}</Text> : null}
    </View>
  );
  const ring = highlight === "sections" ? { borderColor: c.accent, borderWidth: 1.5 } : null;
  return (
    <View className="bg-bg border-line h-[176px] flex-row items-center justify-center gap-3 overflow-hidden rounded-[14px] border px-4">
      <View className="bg-surface border-line w-[200px] rounded-[14px] border p-2.5" style={{ shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
        <View className="mb-1 flex-row justify-between">
          <Text className="text-ink text-[11px] font-bold">Nox</Text>
          <Text className="text-ink-3 text-[10px]">Tue 25 Nov</Text>
        </View>
        <View className="rounded-[8px] p-1" style={ring}>
          <Text className="text-ink-3 text-[9px] font-bold">TODAY · 1/3</Text>
          {row(true, "Morning run")}
          {row(false, "Record the intro", "2:00 PM")}
          {row(false, "Send sponsor deck")}
        </View>
        <View className="mt-1 rounded-[8px] p-1" style={ring}>
          <Text className="text-ink-3 text-[9px] font-bold">🎬 TECH CHANNEL</Text>
          <Text className="text-ink-2 text-[10px]">Idea 3 · Script 1 · Edit 2</Text>
        </View>
      </View>
    </View>
  );
}

const desktop = canOpenDesktopWidget();
const STEPS: { title: string; body: string }[] = [
  {
    title: "Your day, outside the app",
    body: "The Nox widget shows today's tasks, what's next and your spaces, without opening Nox. Tick a task or add one right from it.",
  },
  {
    title: "Make it show what you want",
    body: "In Settings → Widget, turn sections on or off and drag them into your order: today, up next, quick add, a space's pipeline, pinned notes. The preview there is exactly what you'll see.",
  },
  {
    title: "Where to find it",
    body: desktop
      ? "Mac and Windows: Settings → Widget → Show the widget, or the Nox icon in the menu bar / tray. Drag it by its top bar; the pin keeps it above other windows."
      : Platform.OS === "android"
        ? "Long-press your home screen, tap Widgets, and drag Nox onto it. It updates as your day changes; tap any task to open it."
        : "On the Mac and Windows apps it's a small floating window; on Android it's a home-screen widget. Both use the same settings.",
  },
];

/** The widget walkthrough: what it is, how to customize it, where to find it on this device. */
export function WidgetIntro({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);
  const last = step === STEPS.length - 1;
  const s = STEPS[step]!;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-5">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[440px] border p-5" accessibilityViewIsModal>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-ink-3 text-[12px] font-semibold tracking-[0.04em]">THE NOX WIDGET</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" className="hover:bg-chip -mr-1 h-7 w-7 items-center justify-center rounded-[8px]">
              <X size={16} color={c.ink3} strokeWidth={2.2} />
            </Pressable>
          </View>
          <WidgetArt highlight={step === 1 ? "sections" : undefined} />
          <Text className="text-ink mt-4 font-serif text-[21px] font-bold leading-[27px] tracking-[-0.01em]">{s.title}</Text>
          <Text className="text-ink-2 mt-1.5 text-[14px] leading-[21px]" style={{ minHeight: 84 }}>
            {s.body}
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row gap-1.5">
              {STEPS.map((_, i) => (
                <View key={i} className="h-[6px] rounded-full" style={{ width: i === step ? 18 : 6, backgroundColor: i === step ? c.accent : c.line }} />
              ))}
            </View>
            <View className="flex-row items-center gap-1.5">
              {step > 0 ? (
                <Pressable onPress={() => setStep(step - 1)} accessibilityRole="button" className="hover:bg-chip rounded-[10px] px-3 py-2">
                  <Text className="text-ink-2 text-[14px] font-medium">Back</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => (last ? onClose() : setStep(step + 1))} accessibilityRole="button" className="bg-accent hover:opacity-90 flex-row items-center gap-1.5 rounded-[10px] px-4 py-2">
                <Text className="text-on-accent text-[14px] font-semibold">{last ? "Got it" : "Next"}</Text>
                {!last ? <ArrowRight size={14} color={c.onAccent} strokeWidth={2.4} /> : null}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
