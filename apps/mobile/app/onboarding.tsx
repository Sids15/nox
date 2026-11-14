import { parseQuickAdd, useAuth, useCreateTask, usePrefs, useThemeColors } from "@nox/features";
import type { TaskInput } from "@nox/types";
import { accents, type AccentName, type ThemeName } from "@nox/ui";
import { capitalize, formatTime12, relativeDayLabel, todayKey } from "@nox/utils";
import { Redirect, router } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  FileText,
  Lightbulb,
  Sparkles,
  SquareCheckBig,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { pressScale } from "../components/menu";
import { SegmentedControl } from "../components/tasks/segmented-control";
import { useIdentity } from "../lib/use-identity";
import { ensurePermission } from "../lib/notifications";

const STEPS = 5;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ACCENT_ORDER: AccentName[] = ["vermilion", "indigo", "moss", "plum"];
const EXAMPLES = ["Call mum tomorrow at 6pm", "Gym every mon and thu 7am", "Pay rent friday !high"];

/* ─────────────────────────────── pieces ─────────────────────────────── */

function PrimaryButton({ label, onPress, disabled, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={pressScale}
      className={`h-[50px] flex-row items-center justify-center gap-2 rounded-[12px] px-5 ${disabled ? "bg-chip" : "bg-accent hover:opacity-90"}`}
    >
      <Text className={`text-[15.5px] font-semibold ${disabled ? "text-ink-3" : "text-on-accent"}`}>{label}</Text>
      {icon}
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={pressScale} className="hover:bg-chip h-[44px] items-center justify-center rounded-[12px] px-4">
      <Text className="text-ink-2 text-[14.5px] font-semibold">{label}</Text>
    </Pressable>
  );
}

function Title({ children }: { children: string }) {
  return <Text className="text-ink font-serif text-[30px] font-bold leading-[37px] tracking-[-0.01em]">{children}</Text>;
}

function Lead({ children }: { children: ReactNode }) {
  return <Text className="text-ink-2 mt-3 text-[16px] leading-[24px]">{children}</Text>;
}

/** Slides the content of each step in: 12px and a fade on a strong ease-out; a fade alone under reduced motion. */
function StepIn({ step, dir, children }: { step: number; dir: 1 | -1; children: ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 240, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [step, t]);
  const x = t.interpolate({ inputRange: [0, 1], outputRange: [still ? 0 : 12 * dir, 0] });
  return <Animated.View style={{ opacity: t, transform: [{ translateX: x }] }}>{children}</Animated.View>;
}

/* ─────────────────────────────── screen ─────────────────────────────── */

/**
 * First-run onboarding, shown once after sign-up (the tabs layout routes here until it's finished;
 * finishing is stored on the device and on the account, so another device doesn't repeat it).
 *
 * Five short steps, each skippable: what Nox is; the four spaces; your name and look (applied live);
 * reminders, asking for notification permission only when the user chooses to turn them on; and a
 * first task typed in plain words, which teaches quick add by doing it.
 */
export default function OnboardingScreen() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  return <Onboarding />;
}

function Onboarding() {
  const c = useThemeColors();
  const identity = useIdentity();
  const { updateProfile } = useAuth();
  const theme = usePrefs((s) => s.theme);
  const accent = usePrefs((s) => s.accent);
  const setTheme = usePrefs((s) => s.setTheme);
  const setAccent = usePrefs((s) => s.setAccent);
  const setNotif = usePrefs((s) => s.setNotif);
  const setOnboarded = usePrefs((s) => s.setOnboarded);
  const createTask = useCreateTask();
  const today = todayKey();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [name, setName] = useState(identity.name === "You" ? "" : identity.name);
  const [remindState, setRemindState] = useState<"idle" | "asking" | "on" | "off">("idle");
  const [taskText, setTaskText] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const saveName = () => {
    const n = name.trim();
    if (n && n !== identity.name) void updateProfile({ display_name: n }).catch(() => {});
  };

  const finish = () => {
    saveName();
    setOnboarded(true);
    void updateProfile({ onboarded_at: new Date().toISOString() }).catch(() => {});
    router.replace("/(tabs)/tasks");
  };

  const turnOnReminders = async () => {
    setRemindState("asking");
    const granted = await ensurePermission().catch(() => false);
    setNotif("taskReminders", granted);
    setRemindState(granted ? "on" : "off");
  };

  const parsed = useMemo(() => parseQuickAdd(taskText, today), [taskText, today]);
  const addTask = () => {
    const title = parsed.title.trim();
    if (!title) return;
    const repeat = parsed.repeat;
    const input: TaskInput = {
      title: title.slice(0, 200),
      notes: null,
      due_date: parsed.date ?? today,
      due_time: parsed.time ?? null,
      reminder_times: [],
      priority: parsed.priority ?? "medium",
      repeat: repeat?.kind ?? "none",
      repeat_config: repeat?.kind === "custom" ? { weekdays: repeat.weekdays ?? [] } : null,
    };
    createTask.create(input);
    const when = [capitalize(relativeDayLabel(input.due_date!, today)), input.due_time ? formatTime12(input.due_time) : null]
      .filter(Boolean)
      .join(" at ");
    setAdded(`${title} — ${when}`);
    setTaskText("");
  };

  const spaces: { icon: LucideIcon; name: string; line: string }[] = [
    { icon: SquareCheckBig, name: "Tasks", line: "Plan each day, with times, reminders and repeats." },
    { icon: Lightbulb, name: "Ideas", line: "Catch a spark and grow it from raw to done." },
    { icon: FileText, name: "Notes", line: "Write freely, with photos, links and voice notes." },
    { icon: Bookmark, name: "Resources", line: "Keep the links, clips and snippets worth saving." },
  ];

  const body = [
    /* 0 — welcome */
    <View key="welcome">
      <Image
        source={require("../assets/nox-wordmark.png")}
        style={{ width: 92, height: 54, tintColor: c.ink, marginLeft: -4 }}
        resizeMode="contain"
        accessibilityLabel="Nox"
      />
      <View className="mt-8">
        <Title>A quiet notebook for everything you're working on.</Title>
      </View>
      <Lead>Plan the day, catch ideas, keep notes and save what's worth keeping — in one place, on your phone and your computer.</Lead>
    </View>,

    /* 1 — the four spaces */
    <View key="spaces">
      <Title>Four spaces, one notebook</Title>
      <Lead>Everything stays in sync wherever you open Nox.</Lead>
      <View className="mt-7">
        {spaces.map(({ icon: Icon, name: n, line }, i) => (
          <View key={n} className={`flex-row items-start gap-4 py-4 ${i > 0 ? "border-line border-t" : ""}`}>
            <View className="bg-accent/[0.12] h-10 w-10 items-center justify-center rounded-[11px]">
              <Icon size={19} color={c.accent} strokeWidth={1.9} />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-[16.5px] font-semibold">{n}</Text>
              <Text className="text-ink-2 mt-0.5 text-[14.5px] leading-[21px]">{line}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>,

    /* 2 — you */
    <View key="you">
      <Title>Make it yours</Title>
      <Lead>We'll use your name in greetings. You can change all of this later in Settings.</Lead>

      <Text className="text-ink-2 mb-2 mt-7 text-[13.5px] font-semibold">Your name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        onBlur={saveName}
        placeholder="First name"
        placeholderTextColor={c.ink3}
        autoCapitalize="words"
        autoComplete="name"
        maxLength={80}
        accessibilityLabel="Your name"
        className="bg-surface border-line text-ink h-[50px] rounded-[12px] border px-4 text-[16px]"
        style={{ paddingVertical: 0 }}
      />

      <Text className="text-ink-2 mb-2 mt-6 text-[13.5px] font-semibold">Appearance</Text>
      <SegmentedControl<ThemeName>
        value={theme}
        onChange={setTheme}
        options={[
          { value: "light", label: "Paper" },
          { value: "dark", label: "Night" },
        ]}
      />

      <Text className="text-ink-2 mb-2 mt-6 text-[13.5px] font-semibold">Accent</Text>
      <View className="flex-row gap-3">
        {ACCENT_ORDER.map((a) => {
          const on = a === accent;
          return (
            <Pressable
              key={a}
              onPress={() => setAccent(a)}
              accessibilityRole="radio"
              accessibilityLabel={`${capitalize(a)} accent`}
              accessibilityState={{ checked: on }}
              style={pressScale}
              className="items-center gap-1.5"
            >
              <View
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: accents[a], borderWidth: on ? 3 : 0, borderColor: c.bg, outlineColor: accents[a], outlineWidth: on ? 2 : 0, outlineStyle: "solid" } as object}
              >
                {on && <Check size={18} color="#fff" strokeWidth={3} />}
              </View>
              <Text className={`text-[12px] ${on ? "text-ink font-semibold" : "text-ink-3"}`}>{capitalize(a)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>,

    /* 3 — reminders */
    <View key="remind">
      <Title>Don't miss what matters</Title>
      <Lead>Nox can nudge you before a task is due, and again each morning and evening to plan the day.</Lead>

      {/* What a reminder looks like. Illustrative. */}
      <View
        className="border-line bg-elev mt-7 flex-row items-start gap-3 rounded-[16px] border p-4"
        style={{ shadowColor: "#1B2131", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}
        accessibilityLabel="Example reminder: Dentist appointment, in 1 hour"
      >
        <View className="bg-accent h-9 w-9 items-center justify-center rounded-[9px]">
          <Bell size={17} color={c.onAccent} strokeWidth={2.2} />
        </View>
        <View className="flex-1">
          <View className="flex-row justify-between">
            <Text className="text-ink-3 text-[12px] font-semibold">Nox</Text>
            <Text className="text-ink-3 text-[12px]">now</Text>
          </View>
          <Text className="text-ink mt-0.5 text-[15px] font-semibold">Dentist appointment</Text>
          <Text className="text-ink-2 text-[14px]">In 1 hour · 11:30 AM</Text>
        </View>
      </View>

      <View className="mt-6">
        {remindState === "on" ? (
          <View className="flex-row items-center gap-2">
            <Check size={16} color={c.success} strokeWidth={2.6} />
            <Text className="text-success text-[14.5px] font-semibold">Reminders are on.</Text>
          </View>
        ) : remindState === "off" ? (
          <Text className="text-ink-2 text-[14px] leading-[21px]">
            Notifications aren't allowed here — reminders work in the Nox app on your phone and computer. You can turn them on
            later in Settings.
          </Text>
        ) : (
          <PrimaryButton
            label={remindState === "asking" ? "Asking…" : "Turn on reminders"}
            onPress={() => void turnOnReminders()}
            disabled={remindState === "asking"}
            icon={<Bell size={16} color={c.onAccent} strokeWidth={2.2} />}
          />
        )}
      </View>
    </View>,

    /* 4 — first task */
    <View key="task">
      <Title>Add your first task</Title>
      <Lead>Type it the way you'd say it. Nox picks out the day, time, repeat and priority.</Lead>

      <View className="bg-surface border-line mt-7 rounded-[14px] border px-4 pb-3 pt-3.5">
        <TextInput
          value={taskText}
          onChangeText={(t) => {
            setTaskText(t);
            setAdded(null);
          }}
          onSubmitEditing={addTask}
          placeholder="e.g. Call mum tomorrow at 6pm"
          placeholderTextColor={c.ink3}
          returnKeyType="done"
          maxLength={240}
          accessibilityLabel="Your first task"
          className="text-ink text-[17px] font-semibold"
          style={{ paddingVertical: 0, minHeight: 26 }}
        />
        <View className="mt-2.5 min-h-[24px] flex-row flex-wrap items-center gap-1.5">
          {parsed.matched.length > 0 ? (
            <>
              <Sparkles size={12} color={c.accent} strokeWidth={2.2} />
              {parsed.matched.map((m) => (
                <View key={m.field + m.text} className="bg-accent/[0.12] rounded-[6px] px-1.5 py-0.5">
                  <Text className="text-accent text-[12px] font-semibold">{m.text}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text className="text-ink-3 text-[12.5px]">Dates, times, “every mon”, “!high” are understood.</Text>
          )}
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <Pressable
            key={e}
            onPress={() => {
              setTaskText(e);
              setAdded(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Use example: ${e}`}
            style={pressScale}
            className="border-line hover:bg-surface rounded-pill border px-3 py-[7px]"
          >
            <Text className="text-ink-2 text-[13px]">{e}</Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-5">
        {added ? (
          <View className="bg-success/[0.1] flex-row items-center gap-2.5 rounded-[12px] px-4 py-3">
            <Check size={16} color={c.success} strokeWidth={2.6} />
            <Text className="text-ink flex-1 text-[14.5px]">
              Added <Text className="font-semibold">{added}</Text>
            </Text>
          </View>
        ) : (
          <PrimaryButton label="Add task" onPress={addTask} disabled={!parsed.title.trim()} />
        )}
      </View>
    </View>,
  ][step];

  const last = step === STEPS - 1;
  const nextLabel = step === 0 ? "Get started" : last ? (added ? "Open Nox" : "Skip and open Nox") : "Continue";

  return (
    <SafeAreaView className="bg-bg flex-1">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-1 self-center" style={{ width: "100%", maxWidth: 520 }}>
          {/* Top: progress and skip */}
          <View className="flex-row items-center justify-between px-6 pt-3">
            <View className="flex-row gap-1.5" accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
              {Array.from({ length: STEPS }, (_, i) => (
                <View
                  key={i}
                  className={`h-[5px] rounded-full ${i <= step ? "bg-accent" : "bg-chip"}`}
                  style={{ width: i === step ? 22 : 10 }}
                />
              ))}
            </View>
            {!last && step > 0 ? (
              <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" className="hover:bg-chip rounded-[8px] px-2 py-1">
                <Text className="text-ink-3 text-[14px] font-semibold">Skip</Text>
              </Pressable>
            ) : (
              <View />
            )}
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 28 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <StepIn step={step} dir={dir}>
              {body}
            </StepIn>
          </ScrollView>

          {/* Bottom: back · continue */}
          <View className="flex-row items-center gap-2 px-6 pb-4 pt-2">
            {step > 0 ? (
              <Pressable
                onPress={() => go(step - 1)}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={pressScale}
                className="hover:bg-chip h-[50px] w-[50px] items-center justify-center rounded-[12px]"
              >
                <ArrowLeft size={19} color={c.ink2} strokeWidth={2.2} />
              </Pressable>
            ) : null}
            <View className="flex-1">
              {step === 3 && remindState === "idle" ? (
                <GhostButton label="Not now" onPress={() => go(step + 1)} />
              ) : last && !added ? (
                <GhostButton label={nextLabel} onPress={finish} />
              ) : (
                <PrimaryButton
                  label={nextLabel}
                  onPress={() => (last ? finish() : go(step + 1))}
                  icon={<ArrowRight size={17} color={c.onAccent} strokeWidth={2.4} />}
                />
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
