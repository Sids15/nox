import { WIDGET_SECTION_LABEL, useAuth, usePrefs, useSpaces, useThemeColors, type CalendarPrefs, type NotifKey } from "@nox/features";
import { AiRepository, PushRepository } from "@nox/api";
import type { PushPrefs } from "@nox/types";
import { disablePush, enablePush, pushAvailable, pushUnavailableReason } from "../lib/push";
import { setNoxAi } from "../lib/use-ai";
import { accents, type AccentName, type ThemeName } from "@nox/ui";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { BookmarkletLink, bookmarkletAvailable } from "../components/bookmarklet-link";
import type { LucideIcon } from "lucide-react-native";
import {
  ArrowDown,
  ArrowUp,
  LayoutDashboard,
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Keyboard,
  LogOut,
  Minus,
  Palette,
  Plus,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TABULAR, pressScale } from "../components/menu";
import { useWidgetSnapshot } from "../components/widget/use-widget-snapshot";
import { WidgetView } from "../components/widget/widget-view";
import { WidgetIntro } from "../components/widget/widget-intro";
import { SpaceMark } from "../components/brain/space-mark";
import { canOpenDesktopWidget, toggleDesktopWidget } from "../lib/desktop-widget";
import { Sidebar } from "../components/sidebar";
import { Alert } from "../lib/alert";
import { goBack } from "../lib/go-back";
import { HEADING_STACKS } from "../lib/heading-font";
import { ensurePermission, sendTestNotification } from "../lib/notifications";
import { useIdentity } from "../lib/use-identity";
import { useIsDesktop } from "../lib/use-responsive";
import { useSyncLabel } from "../lib/use-sync-label";

const ACCENTS: { key: AccentName; label: string }[] = [
  { key: "vermilion", label: "Vermilion" },
  { key: "indigo", label: "Indigo" },
  { key: "moss", label: "Moss" },
  { key: "plum", label: "Plum" },
];
/** From app.json rather than a hard-coded string that drifted from the real release. */
const APP_VERSION = Constants.expoConfig?.version ?? "dev";
const hourLabel = (h: number) => (h === 0 || h === 24 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`);
const MOD = Platform.OS === "web" && typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

type SectionKey = "appearance" | "tasks" | "ai" | "widget" | "notifications" | "account" | "about";
const SECTIONS: { key: SectionKey; label: string; Icon: LucideIcon }[] = [
  { key: "appearance", label: "Appearance", Icon: Palette },
  { key: "tasks", label: "Tasks & calendar", Icon: CalendarDays },
  { key: "ai", label: "Nox AI", Icon: Sparkles },
  { key: "widget", label: "Widget", Icon: LayoutDashboard },
  { key: "notifications", label: "Notifications", Icon: BellRing },
  { key: "account", label: "Account & sync", Icon: UserRound },
  { key: "about", label: "About", Icon: Info },
];

// ── Building blocks ───────────────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={{
        width: 42,
        height: 26,
        borderRadius: 99,
        padding: 2,
        justifyContent: "center",
        alignItems: value ? "flex-end" : "flex-start",
        backgroundColor: value ? c.accent : c.chip,
        borderWidth: value ? 0 : 1,
        borderColor: c.line,
      }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 99, backgroundColor: value ? "#FFFFFF" : c.ink3 }} />
    </Pressable>
  );
}

function Segments<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View className="bg-chip flex-row rounded-[9px] p-0.5">
      {options.map((o) => (
        <Pressable
          key={String(o.v)}
          onPress={() => onChange(o.v)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === o.v }}
          className={`h-[30px] justify-center rounded-[7px] px-3 ${value === o.v ? "bg-surface" : ""}`}
          style={value === o.v ? { shadowColor: "#1B2131", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : undefined}
        >
          <Text className={`text-[13px] font-semibold ${value === o.v ? "text-ink" : "text-ink-3"}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Stepper({ value, onDec, onInc, label }: { value: string; onDec: () => void; onInc: () => void; label: string }) {
  const c = useThemeColors();
  return (
    <View className="border-line flex-row items-center rounded-[9px] border">
      <Pressable onPress={onDec} accessibilityRole="button" accessibilityLabel={`Earlier ${label}`} className="hover:bg-chip h-[30px] w-[30px] items-center justify-center rounded-l-[9px]">
        <Minus size={13} color={c.ink2} strokeWidth={2.4} />
      </Pressable>
      <Text style={TABULAR} className="text-ink w-[58px] text-center text-[13px] font-semibold">
        {value}
      </Text>
      <Pressable onPress={onInc} accessibilityRole="button" accessibilityLabel={`Later ${label}`} className="hover:bg-chip h-[30px] w-[30px] items-center justify-center rounded-r-[9px]">
        <Plus size={13} color={c.ink2} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

/** One setting: its name and a line of explanation on the left, the control on the right. */
function Row({ title, detail, children, last, onPress }: { title: string; detail?: string; children?: ReactNode; last?: boolean; onPress?: () => void }) {
  const inner = (
    <>
      <View className="min-w-0 flex-1 pr-3">
        <Text className="text-ink text-[15px] font-medium">{title}</Text>
        {detail ? <Text className="text-ink-3 mt-0.5 text-[13px] leading-[17px]">{detail}</Text> : null}
      </View>
      {children}
    </>
  );
  const cls = `min-h-[56px] flex-row items-center px-4 py-3 ${last ? "" : "border-line border-b"}`;
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" className={`${cls} hover:bg-chip`}>
      {inner}
    </Pressable>
  ) : (
    <View className={cls}>{inner}</View>
  );
}

/** Today's AI requests against the daily allowance, as a bar, and when it resets (the server's UTC midnight). */
function AiAllowance({ used }: { used: number | null }) {
  const c = useThemeColors();
  const limit = AiRepository.dailyLimit;
  if (used === null) {
    return <Row title="Today" detail="Each account gets a daily allowance of AI requests (a few a minute). It resets every day." last />;
  }
  const n = Math.min(used, limit);
  const left = limit - n;
  const now = new Date();
  const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const hours = Math.max(1, Math.ceil((reset - now.getTime()) / 3_600_000));
  const color = left === 0 ? c.high : left <= limit * 0.2 ? c.medium : c.accent;
  return (
    <View className="px-4 py-3">
      <View className="flex-row items-baseline">
        <Text className="text-ink flex-1 text-[15px] font-medium">Today</Text>
        <Text style={TABULAR} className="text-ink-2 text-[13px] font-semibold">
          {n} / {limit}
        </Text>
      </View>
      <View
        className="bg-chip mt-2 h-[6px] overflow-hidden rounded-full"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: limit, now: n }}
        accessibilityLabel="AI requests used today"
      >
        <View style={{ width: `${(n / limit) * 100}%`, height: "100%", backgroundColor: color, borderRadius: 99 }} />
      </View>
      <Text className="text-ink-3 mt-1.5 text-[13px] leading-[17px]">
        {left === 0 ? "None left today" : `${left} left today`} · resets in {hours}h · a few a minute at most
      </Text>
    </View>
  );
}

/**
 * Server reminders (push): they arrive even when Nox is closed. Counts only — no task names leave the
 * server. "On this device" registers the phone or browser; the kinds and the morning hour are per account.
 */
function ServerPushSettings() {
  const on = usePrefs((s) => s.serverPush);
  const setOn = usePrefs((s) => s.setServerPush);
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (on) PushRepository.prefs().then(setPrefs).catch(() => setPrefs(null));
  }, [on]);

  const toggle = async (v: boolean) => {
    setBusy(true);
    setError(null);
    if (v) {
      const err = await enablePush();
      if (err) setError(err);
      else setOn(true);
    } else {
      await disablePush();
      setOn(false);
    }
    setBusy(false);
  };
  const change = (patch: Partial<PushPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    PushRepository.setPrefs(next).catch(() => setError("Couldn't save that. Check your connection."));
  };

  return (
    <>
      <Row
        title="Reminders when Nox is closed"
        detail={
          error ??
          (pushAvailable
            ? "Sent by Nox's server to this device: a morning count of today's tasks, an overdue nudge at 5 PM, and a heads-up when a space's deadline is 2 days away. Only counts are sent — never task names."
            : pushUnavailableReason)
        }
      >
        <Toggle label="Reminders when Nox is closed" value={on} onChange={(v) => (busy || !pushAvailable ? undefined : void toggle(v))} />
      </Row>
      {on && prefs ? (
        <>
          <Row title="Morning count" detail={`${hourLabel(prefs.hour)} · today's tasks and anything overdue`}>
            <View className="flex-row items-center gap-2">
              <Stepper label="morning hour" value={hourLabel(prefs.hour)} onDec={() => change({ hour: Math.max(5, prefs.hour - 1) })} onInc={() => change({ hour: Math.min(12, prefs.hour + 1) })} />
              <Toggle label="Morning count" value={prefs.morning} onChange={(v) => change({ morning: v })} />
            </View>
          </Row>
          <Row title="Overdue nudge" detail="5 PM · when tasks are past their day">
            <Toggle label="Overdue nudge" value={prefs.overdue} onChange={(v) => change({ overdue: v })} />
          </Row>
          <Row title="Space deadlines" detail="9 AM · when a space is due within 2 days">
            <Toggle label="Space deadlines" value={prefs.deadlines} onChange={(v) => change({ deadlines: v })} />
          </Row>
        </>
      ) : null}
    </>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <View className="border-line bg-surface overflow-hidden rounded-[14px] border">{children}</View>;
}

/**
 * Settings → Widget: what the widget shows and in what order, with a live preview. The same settings
 * drive the desktop widget window and the Android home-screen widget.
 */
function WidgetSettings() {
  const c = useThemeColors();
  const widget = usePrefs((s) => s.widget);
  const setWidget = usePrefs((s) => s.setWidget);
  const { data: spaces = [] } = useSpaces();
  const snapshot = useWidgetSnapshot();
  const desktop = canOpenDesktopWidget();
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= widget.sections.length) return;
    const next = [...widget.sections];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setWidget({ sections: next });
  };
  const spaceOn = widget.sections.some((s) => s.key === "space" && s.on);
  const [intro, setIntro] = useState(false);

  return (
    <View className="gap-3">
      <Group>
        {desktop ? (
          <Row title="Show the widget" detail="A small window with your day, beside whatever you're doing. Also in the menu-bar / tray icon." onPress={() => void toggleDesktopWidget()}>
            <LayoutDashboard size={17} color={c.accent} strokeWidth={2} />
          </Row>
        ) : Platform.OS === "android" ? (
          <Row title="Add it to your home screen" detail="Long-press your home screen → Widgets → Nox. It uses the settings below and updates as your day changes." />
        ) : (
          <Row title="Where it lives" detail="On the Mac and Windows apps (a small floating window) and on Android (a home-screen widget). These settings apply to both." />
        )}
        {widget.sections.map((sec, i) => (
          <Row key={sec.key} title={WIDGET_SECTION_LABEL[sec.key]} last={false}>
            <View className="flex-row items-center gap-1">
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel={`Move ${WIDGET_SECTION_LABEL[sec.key]} up`} className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]" style={{ opacity: i === 0 ? 0.3 : 1 }}>
                <ArrowUp size={15} color={c.ink2} strokeWidth={2} />
              </Pressable>
              <Pressable onPress={() => move(i, 1)} disabled={i === widget.sections.length - 1} accessibilityLabel={`Move ${WIDGET_SECTION_LABEL[sec.key]} down`} className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]" style={{ opacity: i === widget.sections.length - 1 ? 0.3 : 1 }}>
                <ArrowDown size={15} color={c.ink2} strokeWidth={2} />
              </Pressable>
              <Toggle label={WIDGET_SECTION_LABEL[sec.key]} value={sec.on} onChange={(on) => setWidget({ sections: widget.sections.map((x) => (x.key === sec.key ? { ...x, on } : x)) })} />
            </View>
          </Row>
        ))}
        {spaceOn ? (
          <View className="border-line border-b px-4 py-3">
            <Text className="text-ink text-[15px] font-medium">Which space</Text>
            {spaces.length === 0 ? (
              <Text className="text-ink-3 mt-0.5 text-[13px]">Make a space first, in Spaces.</Text>
            ) : (
              <View className="mt-2 flex-row flex-wrap gap-1.5">
                {spaces.map((sp) => {
                  const on = (widget.spaceId ?? spaces[0]?.id) === sp.id;
                  return (
                    <Pressable key={sp.id} onPress={() => setWidget({ spaceId: sp.id })} accessibilityRole="radio" accessibilityState={{ checked: on }} className={`rounded-pill border px-3 py-1.5 ${on ? "border-accent bg-accent/[0.1]" : "border-line hover:bg-chip"}`}>
                      <View className="flex-row items-center gap-1.5">
                        <SpaceMark space={sp} size={18} active={on} />
                        <Text className={`text-[13px] ${on ? "text-accent font-semibold" : "text-ink-2"}`}>{sp.name}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
        <Row title="Rows per list" detail="How many tasks or notes each list shows.">
          <Stepper label="rows" value={String(widget.maxItems)} onDec={() => setWidget({ maxItems: widget.maxItems - 1 })} onInc={() => setWidget({ maxItems: widget.maxItems + 1 })} />
        </Row>
        <Row title="Show finished tasks" detail="Keep today's done tasks in the list, crossed out.">
          <Toggle label="Show finished tasks" value={widget.showDone} onChange={(v) => setWidget({ showDone: v })} />
        </Row>
        <Row title="Compact" detail="Tighter rows, more on screen." last={!desktop}>
          <Toggle label="Compact" value={widget.compact} onChange={(v) => setWidget({ compact: v })} />
        </Row>
        {desktop ? (
          <Row title="Keep on top" detail="The widget floats above other windows. The pin in its top bar does the same." last>
            <Toggle label="Keep on top" value={widget.alwaysOnTop} onChange={(v) => setWidget({ alwaysOnTop: v })} />
          </Row>
        ) : null}
      </Group>

      <Pressable onPress={() => setIntro(true)} accessibilityRole="button" className="hover:bg-chip self-start rounded-[8px] px-1.5 py-1">
        <Text className="text-accent text-[14px] font-semibold">How the widget works</Text>
      </Pressable>
      <WidgetIntro visible={intro} onClose={() => setIntro(false)} />

      {/* Live preview: exactly what the widget will show, from your real day. */}
      <Text className="text-ink-3 mt-1 text-[12px] font-semibold tracking-[0.05em]">PREVIEW</Text>
      <View className="border-line bg-bg self-start overflow-hidden rounded-[16px] border p-3" style={{ width: 320, maxWidth: "100%" }}>
        <WidgetView snapshot={snapshot} actions={{ onToggleTask: () => {}, onOpen: () => {}, onCapture: () => {} }} />
      </View>
    </View>
  );
}

/** A miniature page of the app in a theme, for picking Paper or Night. */
function ThemeTile({ theme, selected, onPress, accent }: { theme: ThemeName; selected: boolean; onPress: () => void; accent: string }) {
  const c = useThemeColors();
  const paper = theme === "light";
  const bg = paper ? "#F5F1E8" : "#12151F";
  const ink = paper ? "#1B2131" : "#EDE7DA";
  const line = paper ? "rgba(27,33,49,0.14)" : "rgba(237,231,218,0.14)";
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={paper ? "Paper theme" : "Night theme"} className="flex-1" style={pressScale}>
      <View className="overflow-hidden rounded-[12px]" style={{ backgroundColor: bg, borderWidth: selected ? 2 : 1, borderColor: selected ? c.accent : c.line, height: 92, padding: 12 }}>
        <View style={{ width: 54, height: 8, borderRadius: 3, backgroundColor: ink }} />
        {[0.9, 0.7, 0.8].map((w, i) => (
          <View key={i} className="mt-2.5 flex-row items-center gap-2">
            <View style={{ width: 9, height: 9, borderRadius: 9, borderWidth: 1.5, borderColor: i === 0 ? accent : line, backgroundColor: i === 0 ? accent : "transparent" }} />
            <View style={{ height: 5, borderRadius: 3, backgroundColor: line, width: `${w * 70}%` }} />
          </View>
        ))}
      </View>
      <View className="mt-2 flex-row items-center justify-center gap-1.5">
        {selected && <Check size={13} color={c.accent} strokeWidth={2.6} />}
        <Text className={`text-[14px] ${selected ? "text-ink font-semibold" : "text-ink-2 font-medium"}`}>{paper ? "Paper" : "Night"}</Text>
      </View>
    </Pressable>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <View className="border-line flex-row items-center border-b px-4 py-2.5">
      <Text className="text-ink-2 flex-1 text-[14px]">{label}</Text>
      <View className="flex-row gap-1">
        {keys.map((k) => (
          <View key={k} className="bg-chip border-line min-w-[24px] items-center rounded-[6px] border px-1.5 py-0.5">
            <Text className="text-ink-2 text-[12px] font-semibold">{k}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Settings, in five sections: Appearance (Paper or Night, accent), Tasks & calendar (default view,
 * week start, hours, completed tasks), Notifications, Account & sync, and About (version, shortcuts,
 * privacy). On desktop the sections are listed on the left and scroll into view; phones get one column.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const { session, signOut } = useAuth();
  const { theme, accent, morningSummary, endOfDayPrompt, taskReminders, setTheme, setAccent, setNotif, calendar, setCalendar, headingFont, setHeadingFont, aiEnabled } = usePrefs();
  const [aiUsed, setAiUsed] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  useEffect(() => {
    if (aiEnabled) void AiRepository.usedToday().then(setAiUsed);
  }, [aiEnabled]);
  const sync = useSyncLabel();
  const { name, initials } = useIdentity();
  const email = session?.user?.email ?? "";
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const scroller = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<SectionKey, number>>>({});
  const [current, setCurrent] = useState<SectionKey>("appearance");
  const jump = (k: SectionKey) => {
    setCurrent(k);
    scroller.current?.scrollTo({ y: Math.max(0, (offsets.current[k] ?? 0) - 16), animated: true });
  };

  const handleSignOut = async () => {
    setError(null);
    setSigningOut(true);
    try {
      // Stop server reminders on this device first, so the next person here doesn't get them.
      if (usePrefs.getState().serverPush) {
        await disablePush();
        usePrefs.getState().setServerPush(false);
      }
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
    } finally {
      setSigningOut(false);
    }
  };
  const sendTest = async () => {
    await sendTestNotification();
    Alert.alert(
      "Test sent",
      "If no notification appears in a few seconds, check that notifications are enabled for Nox in your system settings (and that Focus or Do Not Disturb is off).",
    );
  };
  // Turning a notification on needs permission; if it's refused, keep it off and point to system settings.
  const notif = async (key: NotifKey, value: boolean) => {
    if (value && !(await ensurePermission())) {
      Alert.alert("Notifications are off", "Enable notifications for Nox in your system settings to use reminders.", [
        { text: "Not now", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    setNotif(key, value);
  };
  const cal = (p: Partial<CalendarPrefs>) => setCalendar(p);

  const section = (key: SectionKey, title: string, intro: string, body: ReactNode) => (
    <View key={key} onLayout={(e) => (offsets.current[key] = e.nativeEvent.layout.y)} className="mt-8">
      <Text className="text-ink font-serif text-[20px] font-bold">{title}</Text>
      <Text className="text-ink-3 mb-3 mt-0.5 text-[13px]">{intro}</Text>
      {body}
    </View>
  );

  const content = (
    <>
      {/* Profile */}
      <Pressable
        onPress={() => router.push("/account")}
        accessibilityRole="button"
        accessibilityLabel="Account"
        className="border-line bg-surface hover:border-accent/[0.4] mt-5 flex-row items-center gap-3.5 rounded-[14px] border p-4"
      >
        <View className="bg-accent/[0.14] h-12 w-12 items-center justify-center rounded-full">
          <Text className="text-accent font-serif text-[17px] font-bold">{initials}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-ink text-[16px] font-semibold">
            {name}
          </Text>
          <Text numberOfLines={1} className="text-ink-3 mt-0.5 text-[13px]">
            {email || "Not signed in"}
          </Text>
        </View>
        <Text className="text-ink-3 mr-1 text-[13px]">Account</Text>
        <ChevronRight size={16} color={c.ink3} strokeWidth={2} />
      </Pressable>

      {section(
        "appearance",
        "Appearance",
        "How Nox looks on this device.",
        <>
          <View className="flex-row gap-3">
            <ThemeTile theme="light" selected={theme === "light"} onPress={() => setTheme("light")} accent={accents[accent]} />
            <ThemeTile theme="dark" selected={theme === "dark"} onPress={() => setTheme("dark")} accent={accents[accent]} />
          </View>
          <View className="mt-4">
            <Group>
              {/* Web only for now: on phones the heading face is compiled into the app. */}
              {Platform.OS === "web" && (
              <View className="border-line border-b px-4 py-3">
                <Text className="text-ink text-[15px] font-medium">Headings</Text>
                <Text className="text-ink-3 mt-0.5 text-[13px]">The typeface for titles like "Today" and note names.</Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {(
                    [
                      { key: "sans", label: "Clean", sample: "System sans" },
                      { key: "modern", label: "Modern serif", sample: "Charter" },
                      { key: "classic", label: "Classic serif", sample: "Georgia" },
                    ] as const
                  ).map((f) => {
                    const on = headingFont === f.key;
                    return (
                      <Pressable
                        key={f.key}
                        onPress={() => setHeadingFont(f.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${f.label} headings`}
                        className={`min-w-[120px] flex-1 rounded-[12px] border px-3 py-2.5 ${on ? "border-accent bg-accent/[0.07]" : "border-line hover:bg-chip"}`}
                      >
                        <Text
                          className="text-ink text-[20px] font-bold"
                          style={Platform.OS === "web" ? ({ fontFamily: HEADING_STACKS[f.key].family, letterSpacing: HEADING_STACKS[f.key].tracking } as object) : undefined}
                        >
                          Today
                        </Text>
                        <Text className={`mt-0.5 text-[13px] ${on ? "text-accent font-semibold" : "text-ink-3"}`}>{f.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              )}
              <View className="px-4 py-3">
                <Text className="text-ink text-[15px] font-medium">Accent</Text>
                <Text className="text-ink-3 mt-0.5 text-[13px]">Buttons, highlights and today's date.</Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                  {ACCENTS.map((a) => {
                    const on = a.key === accent;
                    return (
                      <Pressable
                        key={a.key}
                        onPress={() => setAccent(a.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${a.label} accent`}
                        className={`flex-row items-center gap-2 rounded-[10px] border px-2.5 py-1.5 ${on ? "" : "border-line hover:bg-chip"}`}
                        style={on ? { borderColor: accents[a.key], backgroundColor: `${accents[a.key]}14` } : undefined}
                      >
                        <View className="h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: accents[a.key] }}>
                          {on && <Check size={10} color="#fff" strokeWidth={3.2} />}
                        </View>
                        <Text className={`text-[13px] ${on ? "text-ink font-semibold" : "text-ink-2 font-medium"}`}>{a.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Group>
          </View>
        </>,
      )}

      {section(
        "tasks",
        "Tasks & calendar",
        "How Tasks opens and what the calendar shows.",
        <Group>
          <Row title="Import tasks" detail="From Todoist, TickTick, Notion, or any list (Apple Reminders, Markdown)." onPress={() => router.push("/import")}>
            <ChevronRight size={16} color={c.ink3} strokeWidth={2} />
          </Row>
          <Row
            title="Save from your browser"
            detail={
              bookmarkletAvailable
                ? "Drag “Save to Nox” to your bookmarks bar. Click it on any page to save the link (and any text you selected) to Nox. In Safari, copy it and paste it as a bookmark's address."
                : "On your computer, open Nox in a browser and find this in Settings to get a “Save to Nox” bookmark."
            }
          >
            <BookmarkletLink />
          </Row>
          <Row title="Ask when and how long" detail="When you add a task with a day but no time, Nox suggests the next free slot and asks how long it takes. Press Enter to skip.">
            <Toggle label="Ask when and how long" value={calendar.askWhenAdding} onChange={(v) => cal({ askWhenAdding: v })} />
          </Row>
          <Row title="Open Tasks as" detail="You can switch any time from the Tasks header.">
            <Segments
              value={calendar.view}
              options={[
                { v: "list", label: "List" },
                { v: "day", label: "Day" },
                { v: "week", label: isDesktop ? "Week" : "3 days" },
              ]}
              onChange={(v) => cal({ view: v })}
            />
          </Row>
          <Row title="Week starts on">
            <Segments value={calendar.weekStartsOn} options={[{ v: 1, label: "Monday" }, { v: 0, label: "Sunday" }]} onChange={(v) => cal({ weekStartsOn: v as 0 | 1 })} />
          </Row>
          <Row title="Day starts" detail="The first hour the calendar shows. Earlier tasks still appear.">
            <Stepper label="start" value={hourLabel(calendar.startHour)} onDec={() => cal({ startHour: Math.max(0, calendar.startHour - 1) })} onInc={() => cal({ startHour: Math.min(calendar.endHour - 1, calendar.startHour + 1) })} />
          </Row>
          <Row title="Day ends">
            <Stepper label="end" value={hourLabel(calendar.endHour)} onDec={() => cal({ endHour: Math.max(calendar.startHour + 1, calendar.endHour - 1) })} onInc={() => cal({ endHour: Math.min(24, calendar.endHour + 1) })} />
          </Row>
          <Row title="Show weekends" detail="In the week view.">
            <Toggle label="Show weekends" value={calendar.showWeekends} onChange={(v) => cal({ showWeekends: v })} />
          </Row>
          <Row title="Show completed tasks" detail="In the calendar. Done tasks are struck through." last>
            <Toggle label="Show completed tasks" value={calendar.showCompleted} onChange={(v) => cal({ showCompleted: v })} />
          </Row>
        </Group>,
      )}

      {section(
        "ai",
        "Nox AI",
        "Planning your day, typing tasks in plain words, note help, the idea coach, tag suggestions, Ask Nox and briefs.",
        <Group>
          <Row
            title="Use Nox AI"
            detail={
              aiError ??
              "Applies to your whole account, on every device. Off hides every AI button and the server refuses AI requests. On, only what a feature needs is sent, and only when you tap it."
            }
          >
            <Toggle
              label="Use Nox AI"
              value={aiEnabled}
              onChange={(v) => {
                setAiError(null);
                void setNoxAi(v).then(setAiError);
              }}
            />
          </Row>
          <Row
            title="What gets sent"
            detail="Plan day sends task titles, times and priorities. Note and idea help sends that one note or idea. Ask Nox sends the few items that match your question. Your account details never are."
          />
          <AiAllowance used={aiUsed} />
        </Group>,
      )}

      {section("widget", "Widget", "Your day at a glance, outside the app. Pick what it shows and in what order.", <WidgetSettings />)}

      {section(
        "notifications",
        "Notifications",
        "What Nox may tell you, and when.",
        <Group>
          <Row title="Morning summary" detail="8:00 AM · what's on today">
            <Toggle label="Morning summary" value={morningSummary} onChange={(v) => notif("morningSummary", v)} />
          </Row>
          <Row title="End-of-day prompt" detail="9:00 PM · plan tomorrow">
            <Toggle label="End-of-day prompt" value={endOfDayPrompt} onChange={(v) => notif("endOfDayPrompt", v)} />
          </Row>
          <Row title="Task reminders" detail="At the reminder times you set on each task">
            <Toggle label="Task reminders" value={taskReminders} onChange={(v) => notif("taskReminders", v)} />
          </Row>
          <ServerPushSettings />
          <Row title="Send a test notification" detail="Check that reminders can reach this device" onPress={sendTest} last>
            <BellRing size={17} color={c.accent} strokeWidth={2} />
          </Row>
        </Group>,
      )}

      {section(
        "account",
        "Account & sync",
        "Your notebook lives in your account and syncs to every device you sign in on.",
        <Group>
          <Row title="Sync" detail={sync.detail ?? "All changes saved"}>
            <View className="flex-row items-center gap-2">
              <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: sync.color }} />
              <Text className="text-ink-2 text-[14px] font-medium">{sync.title}</Text>
            </View>
          </Row>
          <Row title="Account" detail="Name, email, password, and deleting your account" onPress={() => router.push("/account")}>
            <ChevronRight size={16} color={c.ink3} strokeWidth={2} />
          </Row>
          <Row title="Sign out" detail="Your notes stay in your account." onPress={handleSignOut} last>
            {signingOut ? <RefreshCw size={16} color={c.ink3} strokeWidth={2} /> : <LogOut size={16} color={c.high} strokeWidth={2} />}
          </Row>
        </Group>,
      )}
      {error ? <Text className="text-high mt-2 text-[13px]">{error}</Text> : null}

      {section(
        "about",
        "About",
        `Nox ${APP_VERSION}`,
        <>
          {isDesktop && (
            <Group>
              <View className="border-line flex-row items-center gap-2 border-b px-4 py-3">
                <Keyboard size={15} color={c.ink2} strokeWidth={2} />
                <Text className="text-ink text-[15px] font-medium">Keyboard shortcuts</Text>
              </View>
              <Shortcut keys={[MOD, "K"]} label="Search everything" />
              <Shortcut keys={["⌥", "1–5"]} label="Ideas, Notes, Tasks, Resources, Spaces" />
              <Shortcut keys={["Enter"]} label="Add the task you're typing" />
              <Shortcut keys={[MOD, "Enter"]} label="Add a task from anywhere in the box" />
              <View className="flex-row items-center px-4 py-2.5">
                <Text className="text-ink-2 flex-1 text-[14px]">Close a dialog or menu</Text>
                <View className="bg-chip border-line rounded-[6px] border px-1.5 py-0.5">
                  <Text className="text-ink-2 text-[12px] font-semibold">Esc</Text>
                </View>
              </View>
            </Group>
          )}
          <Text className="text-ink-3 mt-4 text-[13px] leading-[19px]">
            Your notes, ideas, tasks and resources are stored in your account and visible only to you. Dictation in Chrome and Edge is transcribed by the browser's speech service; Nox doesn't record or keep the audio.
          </Text>
        </>,
      )}
    </>
  );

  const header = (
    <View className="flex-row items-center gap-2">
      <Pressable onPress={() => goBack("/tasks")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" className="hover:bg-chip -ml-2 h-9 w-9 items-center justify-center rounded-[10px]">
        <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
      </Pressable>
      <Text className="text-ink font-serif text-[30px] font-bold">Settings</Text>
    </View>
  );

  if (!isDesktop) {
    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 20, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          {header}
          {content}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <View className="flex-1 flex-row">
        <Sidebar />
        <View className="flex-1 flex-row justify-center">
          {/* Section links */}
          <View className="w-[200px] pr-4 pt-[30px]">
            <View className="gap-0.5" style={{ marginTop: 52 }}>
              {SECTIONS.map(({ key, label, Icon }) => {
                const on = current === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => jump(key)}
                    accessibilityRole="link"
                    accessibilityLabel={`Go to ${label}`}
                    className={`h-[36px] flex-row items-center gap-2.5 rounded-[10px] px-3 ${on ? "bg-accent/[0.12]" : "hover:bg-chip"}`}
                  >
                    <Icon size={15} color={on ? c.accent : c.ink2} strokeWidth={2} />
                    <Text className={`text-[14px] ${on ? "text-accent font-semibold" : "text-ink-2 font-medium"}`}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <ScrollView
            ref={scroller}
            style={{ maxWidth: 640, flex: 1 }}
            contentContainerStyle={{ paddingBottom: 80, paddingTop: 30, paddingHorizontal: 8 }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={64}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y + 80;
              let k: SectionKey = "appearance";
              for (const s of SECTIONS) if ((offsets.current[s.key] ?? Infinity) <= y) k = s.key;
              setCurrent(k);
            }}
          >
            {header}
            {content}
          </ScrollView>
          <View className="w-[60px]" />
        </View>
      </View>
    </SafeAreaView>
  );
}
