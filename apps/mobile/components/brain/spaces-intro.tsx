import { useThemeColors, useThemeVars } from "@nox/features";
import { ArrowRight, ChevronRight, FileText, Lightbulb, Link2, SquareCheckBig, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Modal, Pressable, Text, View } from "react-native";
import { SpaceMark } from "./space-mark";

/** A tiny drawn version of the real screen, so each step shows what it means instead of describing it. */
export function Frame({ children }: { children: ReactNode }) {
  return <View className="bg-bg border-line h-[176px] justify-center overflow-hidden rounded-[14px] border px-4">{children}</View>;
}

function MiniSpace({ icon, name, meta }: { icon: string; name: string; meta: string }) {
  return (
    <View className="bg-surface border-line flex-row items-center gap-2.5 rounded-[10px] border px-2.5 py-2">
      <SpaceMark space={{ icon }} size={26} />
      <View className="flex-1">
        <Text className="text-ink text-[12px] font-semibold">{name}</Text>
        <Text className="text-ink-3 text-[11px]">{meta}</Text>
      </View>
    </View>
  );
}

export function StepSpaces() {
  return (
    <Frame>
      <View className="gap-1.5">
        <MiniSpace icon="clapperboard" name="Tech channel" meta="12 pages · 3 open tasks" />
        <MiniSpace icon="rocket" name="Nox launch" meta="8 pages · 5 open tasks" />
        <MiniSpace icon="file-text" name="PRDs" meta="6 pages · 1 open task" />
      </View>
    </Frame>
  );
}

function StepInside() {
  const c = useThemeColors();
  const rows: { Icon: typeof FileText; t: string }[] = [
    { Icon: Lightbulb, t: "Rust in 100 seconds" },
    { Icon: FileText, t: "Sponsor talking points" },
    { Icon: SquareCheckBig, t: "Record the intro" },
    { Icon: Link2, t: "Reference video" },
  ];
  return (
    <Frame>
      <View className="mb-2 flex-row gap-1">
        {["Board", "Pages", "Tasks", "Resources"].map((t, i) => (
          <View key={t} className={`rounded-pill px-2 py-[3px] ${i === 1 ? "bg-ink" : "bg-chip"}`}>
            <Text className={`text-[11px] font-semibold ${i === 1 ? "text-bg" : "text-ink-2"}`}>{t}</Text>
          </View>
        ))}
      </View>
      {rows.map(({ Icon, t }) => (
        <View key={t} className="border-line flex-row items-center gap-2 border-b py-[5px]">
          <Icon size={11} color={c.ink3} strokeWidth={2} />
          <Text className="text-ink text-[11px]">{t}</Text>
        </View>
      ))}
    </Frame>
  );
}

export function StepBoard() {
  const c = useThemeColors();
  const cols: { name: string; cards: string[] }[] = [
    { name: "Idea", cards: ["Rust in 100s", "Desk tour"] },
    { name: "Script", cards: ["Why I left VS Code"] },
    { name: "Film", cards: [] },
  ];
  return (
    <Frame>
      <View className="flex-row gap-1.5">
        {cols.map((col, i) => (
          <View key={col.name} className="bg-surface border-line flex-1 rounded-[9px] border p-1.5" style={{ minHeight: 120 }}>
            <Text className="text-ink mb-1 text-[11px] font-semibold">{col.name}</Text>
            {col.cards.map((t) => (
              <View key={t} className="bg-bg border-line mb-1 rounded-[6px] border px-1.5 py-1">
                <Text className="text-ink text-[11px]">{t}</Text>
                {i === 0 && t === "Rust in 100s" ? (
                  <View className="mt-0.5 flex-row justify-end">
                    <View className="bg-accent/[0.16] rounded-[4px] px-0.5">
                      <ChevronRight size={9} color={c.accent} strokeWidth={2.6} />
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </Frame>
  );
}

export function StepLinks() {
  const c = useThemeColors();
  return (
    <Frame>
      <Text className="text-ink text-[12px]">
        Script draft. See <Text className="text-accent font-semibold">[[Rust</Text>
      </Text>
      <View className="bg-elev border-line mt-1.5 rounded-[9px] border p-1">
        {["Rust in 100 seconds", "Rust learning notes"].map((t, i) => (
          <View key={t} className={`flex-row items-center gap-1.5 rounded-[6px] px-1.5 py-1 ${i === 0 ? "bg-chip" : ""}`}>
            <FileText size={10} color={c.ink2} strokeWidth={2} />
            <Text className="text-ink text-[11px]">{t}</Text>
          </View>
        ))}
      </View>
      <Text className="text-ink-3 mt-2.5 text-[11px] font-semibold">Linked from · 2</Text>
      <Text className="text-ink-2 text-[11px]">Video PRD · Sponsor notes</Text>
    </Frame>
  );
}

const STEPS: { title: string; body: string; art: () => ReactNode }[] = [
  {
    title: "A space for each part of your life",
    body: "Make one for each YouTube channel, project or set of PRDs. Your notes, ideas, tasks and links for it stay together.",
    art: () => <StepSpaces />,
  },
  {
    title: "Everything for it, in one place",
    body: "Open a space to see only its pages, tasks and saved links. Add to it with New, or pick a space from Details on any page.",
    art: () => <StepInside />,
  },
  {
    title: "Move work through a pipeline",
    body: "Each space can have its own stages, like Idea → Script → Film → Published. The board shows where everything is; tap › to move a card along.",
    art: () => <StepBoard />,
  },
  {
    title: "Link your thinking",
    body: "Type [[ in any note or idea to link another page. Every page lists what links to it, so you can follow a thought both ways. Templates give PRDs and video ideas a ready structure.",
    art: () => <StepLinks />,
  },
];

/**
 * The Spaces walkthrough: four short steps, each with a drawn preview. Shown the first time Spaces
 * opens, and again from "How Spaces work". The last step offers to make the first space.
 */
export function SpacesIntro({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate?: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const go = (next: number) => {
    if (reduceMotion) return setStep(next);
    Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fade, { toValue: 1, duration: 170, useNativeDriver: true }).start();
    });
  };
  const last = step === STEPS.length - 1;
  const s = STEPS[step]!;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-5">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[440px] border p-5" accessibilityViewIsModal>
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-ink-3 text-[12px] font-semibold tracking-[0.04em]">HOW SPACES WORK</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" className="hover:bg-chip -mr-1 h-7 w-7 items-center justify-center rounded-[8px]">
              <X size={16} color={c.ink3} strokeWidth={2.2} />
            </Pressable>
          </View>

          <Animated.View style={{ opacity: fade }}>
            {s.art()}
            <Text className="text-ink mt-4 font-serif text-[20px] font-bold leading-[26px] tracking-[-0.01em]">{s.title}</Text>
            <Text className="text-ink-2 mt-1.5 text-[14px] leading-[21px]" style={{ minHeight: 84 }}>
              {s.body}
            </Text>
          </Animated.View>

          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row gap-1.5" accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((_, i) => (
                <Pressable key={i} onPress={() => go(i)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Step ${i + 1}`}>
                  <View className="h-[6px] rounded-full" style={{ width: i === step ? 18 : 6, backgroundColor: i === step ? c.accent : c.line }} />
                </Pressable>
              ))}
            </View>
            <View className="flex-row items-center gap-1.5">
              {step > 0 ? (
                <Pressable onPress={() => go(step - 1)} accessibilityRole="button" className="hover:bg-chip rounded-[10px] px-3 py-2">
                  <Text className="text-ink-2 text-[14px] font-medium">Back</Text>
                </Pressable>
              ) : (
                <Pressable onPress={onClose} accessibilityRole="button" className="hover:bg-chip rounded-[10px] px-3 py-2">
                  <Text className="text-ink-3 text-[14px] font-medium">Skip</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  if (!last) return go(step + 1);
                  onClose();
                  onCreate?.();
                }}
                accessibilityRole="button"
                className="bg-accent hover:opacity-90 flex-row items-center gap-1.5 rounded-[10px] px-4 py-2"
              >
                <Text className="text-on-accent text-[14px] font-semibold">{last ? (onCreate ? "Make a space" : "Got it") : "Next"}</Text>
                {!last ? <ArrowRight size={14} color={c.onAccent} strokeWidth={2.4} /> : null}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
