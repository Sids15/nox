import { usePrefs, useThemeColors } from "@nox/features";
import type { Task } from "@nox/types";
import {
  addDays,
  capitalize as cap,
  dayOfMonth,
  dayOfWeek,
  formatTime12,
  monthShort,
  relativeDayLabel,
  toDateKey,
  weekdayShort,
} from "@nox/utils";
import { Bell, BellPlus, Calendar, Check, Clock, Flag, Plus, Repeat, Sparkles, X, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { NoxDateTimePicker } from "../date-time-picker";
import { MiniCalendar } from "./mini-calendar";

/**
 * The task property bar — Date · Time · Remind · Repeat · Priority — shared by the new-task dialog and
 * the task editor so both look and behave the same. Each property is a compact button showing its
 * value; tapping one opens its options panel underneath. Purely controlled: it reports a patch through
 * `onChange` and the caller decides what to do with it (hold it as a draft, or save it).
 */

/* ─────────────────────────────── model + helpers ─────────────────────────────── */

export type RepeatKind = Task["repeat"];
export interface RepeatValue {
  kind: RepeatKind;
  weekdays: number[];
}
export interface TaskProps {
  date: string | null;
  time: string | null;
  /** Absolute ISO timestamps. */
  reminders: string[];
  repeat: RepeatValue;
  priority: Task["priority"];
}
type Panel = "date" | "time" | "remind" | "repeat" | "priority";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export function localDate(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const [h, min] = time.split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, h, min, 0, 0);
}
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The moment reminders are measured from: the due time, or 9 AM on an all-day task's day. */
export function anchorOf(date: string | null, time: string | null): Date | null {
  return date ? localDate(date, time ?? "09:00") : null;
}

/**
 * Keep reminders at the same distance from the task when its date or time moves — "1 hour before"
 * stays one hour before. Without this, moving a task to next week left its reminders on the old day.
 */
export function rebaseReminders(reminders: string[], from: Date | null, to: Date | null): string[] {
  if (!from || !to || from.getTime() === to.getTime()) return reminders;
  const delta = to.getTime() - from.getTime();
  return reminders.map((iso) => new Date(new Date(iso).getTime() + delta).toISOString());
}

/** "Today", "Tomorrow", "Mon 16 Nov", "2 Jan 2027". */
export function dateLabel(key: string, today: string): string {
  const rel = relativeDayLabel(key, today);
  if (rel === "today" || rel === "tomorrow" || rel === "yesterday") return cap(rel);
  const month = cap(monthShort(key).toLowerCase());
  if (key.slice(0, 4) !== today.slice(0, 4)) return `${dayOfMonth(key)} ${month} ${key.slice(0, 4)}`;
  return `${cap(weekdayShort(key).toLowerCase())} ${dayOfMonth(key)} ${month}`;
}

export function repeatLabel(r: RepeatValue, date: string | null): string {
  switch (r.kind) {
    case "none":
      return "Repeat";
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return date ? `Every ${WEEKDAY_SHORT[dayOfWeek(date)]}` : "Weekly";
    case "custom":
      return r.weekdays.length ? r.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ") : "Custom";
  }
}

const sameMinute = (a: string, b: string) =>
  Math.floor(new Date(a).getTime() / 60_000) === Math.floor(new Date(b).getTime() / 60_000);

/** "1 hour before", "at time", "2 days before" — relative to the anchor; null when it isn't a round offset. */
function describeOffset(iso: string, anchor: Date | null): string | null {
  if (!anchor) return null;
  const mins = Math.round((anchor.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins === 0) return "at time";
  if (mins < 0) return null;
  if (mins < 60) return `${mins} min before`;
  if (mins % 1440 === 0) return `${mins / 1440} day${mins === 1440 ? "" : "s"} before`;
  if (mins % 60 === 0 && mins < 1440) return `${mins / 60} hour${mins === 60 ? "" : "s"} before`;
  return null;
}

function reminderText(iso: string, today: string): string {
  const d = new Date(iso);
  return `${dateLabel(toDateKey(d), today)} · ${formatTime12(hhmm(d))}`;
}

/** Presets for the Remind panel, as absolute times for the current date/time. */
function reminderPresets(date: string | null, time: string | null): { label: string; at: Date }[] {
  if (!date) return [];
  if (time) {
    const t = localDate(date, time).getTime();
    return [
      { label: "At time of task", at: new Date(t) },
      { label: "5 min before", at: new Date(t - 5 * 60_000) },
      { label: "15 min before", at: new Date(t - 15 * 60_000) },
      { label: "30 min before", at: new Date(t - 30 * 60_000) },
      { label: "1 hour before", at: new Date(t - 60 * 60_000) },
      { label: "2 hours before", at: new Date(t - 120 * 60_000) },
      { label: "1 day before", at: localDate(addDays(date, -1), time) },
      { label: "2 days before", at: localDate(addDays(date, -2), time) },
    ];
  }
  return [
    { label: "Morning of", at: localDate(date, "09:00") },
    { label: "Noon on the day", at: localDate(date, "12:00") },
    { label: "Evening of", at: localDate(date, "18:00") },
    { label: "Day before, morning", at: localDate(addDays(date, -1), "09:00") },
    { label: "Day before, evening", at: localDate(addDays(date, -1), "18:00") },
    { label: "A week before", at: localDate(addDays(date, -7), "09:00") },
  ];
}

/* ─────────────────────────────── primitives ─────────────────────────────── */

/**
 * A property button. Unset properties are quiet — no box, just icon + name, a chip fill on hover — so
 * the bar reads as a few set values rather than a row of empty outlines. Set ones get a tinted fill;
 * `auto` adds a sparkle when the value was read from the typed title rather than picked.
 */
function PropButton({
  icon: Icon,
  label,
  set,
  open,
  color,
  auto,
  onPress,
  onClear,
}: {
  icon: LucideIcon;
  label: string;
  set: boolean;
  open: boolean;
  color?: string;
  auto?: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  const c = useThemeColors();
  const tint = color ?? (set ? c.accent : c.ink2);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      className={`h-[32px] flex-row items-center gap-1.5 rounded-[9px] border px-2.5 ${
        open
          ? "border-accent/[0.6] bg-accent/[0.14]"
          : set
            ? "border-accent/[0.22] bg-accent/[0.08] hover:bg-accent/[0.14]"
            : "hover:bg-chip border-transparent"
      }`}
    >
      <Icon size={14} color={set || open ? tint : c.ink3} strokeWidth={2} />
      <Text style={{ color: set || open ? tint : c.ink2 }} className="text-[13px] font-semibold">
        {label}
      </Text>
      {auto && <Sparkles size={11} color={tint} strokeWidth={2.2} />}
      {set && onClear && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onClear();
          }}
          hitSlop={8}
          accessibilityLabel={`Clear ${label}`}
          className="-mr-0.5 ml-0.5"
        >
          <X size={12} color={tint} strokeWidth={2.4} />
        </Pressable>
      )}
    </Pressable>
  );
}

function OptionRow({
  label,
  hint,
  selected,
  onPress,
  icon,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] ${selected ? "bg-accent/[0.1]" : "hover:bg-chip"}`}
    >
      {icon}
      <Text className={`flex-1 text-[13.5px] ${selected ? "text-accent font-semibold" : "text-ink"}`}>{label}</Text>
      {hint ? <Text className="text-ink-3 font-mono text-[11px]">{hint}</Text> : null}
      {selected ? <Check size={14} color={c.accent} strokeWidth={2.6} /> : null}
    </Pressable>
  );
}

function PanelTitle({ children }: { children: string }) {
  return (
    <Text className="text-ink-3 mb-1.5 mt-1 px-1 font-mono text-[10px] font-semibold tracking-[0.14em]">{children}</Text>
  );
}

/** A two-line selectable card (time presets, reminder presets). */
function PresetCard({
  title,
  sub,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  sub: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className={`min-w-[132px] flex-1 rounded-[10px] border px-3 py-2 ${
        selected ? "border-accent bg-accent/[0.12]" : "border-line hover:bg-chip"
      } ${disabled ? "opacity-35" : ""}`}
    >
      <Text className={`text-[12px] font-semibold ${selected ? "text-accent" : "text-ink-3"}`}>{title}</Text>
      <Text className={`mt-0.5 text-[13.5px] font-bold ${selected ? "text-accent" : "text-ink"}`}>{sub}</Text>
    </Pressable>
  );
}

/* ─────────────────────────────── remind panel ─────────────────────────────── */

/**
 * Reminders: what's set (each removable), a grid of presets for this task's date/time (several
 * reminders allowed), and an exact date + time for anything else — which also works on a task with
 * no date. Presets already in the past are shown but disabled, since they could never fire.
 */
function RemindPanel({
  date,
  time,
  reminders,
  today,
  compact,
  onChange,
}: {
  date: string | null;
  time: string | null;
  reminders: string[];
  today: string;
  compact: boolean;
  onChange: (next: string[]) => void;
}) {
  const c = useThemeColors();
  const theme = usePrefs((s) => s.theme);
  const now = Date.now();
  const anchor = anchorOf(date, time);
  const presets = reminderPresets(date, time);
  const sorted = [...reminders].sort();

  const [custom, setCustom] = useState(presets.length === 0);
  const [cDate, setCDate] = useState<string>(date ?? today);
  const [cTime, setCTime] = useState<string>(time ?? "09:00");
  const customAt = localDate(cDate, cTime);
  const customPast = customAt.getTime() <= now;
  const customDup = reminders.some((r) => sameMinute(r, customAt.toISOString()));

  const toggle = (at: Date) => {
    const iso = at.toISOString();
    onChange(reminders.some((r) => sameMinute(r, iso)) ? reminders.filter((r) => !sameMinute(r, iso)) : [...reminders, iso]);
  };

  return (
    <View>
      {/* What's set */}
      <PanelTitle>{sorted.length ? `REMINDERS · ${sorted.length}` : "NO REMINDERS YET"}</PanelTitle>
      {sorted.length > 0 && (
        <View className="border-line bg-surface mb-2 overflow-hidden rounded-[10px] border">
          {sorted.map((iso, i) => {
            const past = new Date(iso).getTime() <= now;
            const rel = describeOffset(iso, anchor);
            return (
              <View key={iso} className={`flex-row items-center gap-2.5 px-3 py-2 ${i > 0 ? "border-line border-t" : ""}`}>
                <Bell size={13} color={past ? c.ink3 : c.accent} strokeWidth={2} />
                <View className="flex-1">
                  <Text className={`text-[13px] font-semibold ${past ? "text-ink-3 line-through" : "text-ink"}`}>
                    {reminderText(iso, today)}
                  </Text>
                  {rel || past ? (
                    <Text className="text-ink-3 mt-px text-[11px]">{past ? "already passed — won't fire" : rel}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => onChange(reminders.filter((r) => r !== iso))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove reminder ${reminderText(iso, today)}`}
                  className="hover:bg-chip h-7 w-7 items-center justify-center rounded-full"
                >
                  <X size={14} color={c.ink3} strokeWidth={2.2} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* Presets */}
      {presets.length > 0 && (
        <>
          <PanelTitle>{time ? `RELATIVE TO ${formatTime12(time)!.toUpperCase()}` : "FOR AN ALL-DAY TASK"}</PanelTitle>
          <View className="flex-row flex-wrap gap-1.5">
            {presets.map((p) => (
              <PresetCard
                key={p.label}
                title={p.label}
                sub={
                  // Just the time on the task's own day; weekday + time otherwise ("Sun 11:30 AM").
                  toDateKey(p.at) === date
                    ? formatTime12(hhmm(p.at))!
                    : `${WEEKDAY_SHORT[p.at.getDay()]} ${formatTime12(hhmm(p.at))}`
                }
                selected={reminders.some((r) => sameMinute(r, p.at.toISOString()))}
                disabled={p.at.getTime() <= now}
                onPress={() => toggle(p.at)}
              />
            ))}
          </View>
        </>
      )}

      {/* Exact date + time */}
      <View className="mt-2">
        <OptionRow
          label={presets.length ? "Pick an exact date & time…" : "Remind me at…"}
          icon={<BellPlus size={14} color={custom ? c.accent : c.ink2} strokeWidth={2} />}
          selected={custom}
          onPress={() => setCustom((v) => !v)}
        />
        {custom && (
          <View className={`mt-2 ${compact ? "gap-3" : "flex-row gap-4"}`}>
            <View style={compact ? undefined : { width: 260 }}>
              <MiniCalendar selected={cDate} today={today} onSelect={setCDate} />
            </View>
            <View className="flex-1 justify-between gap-3">
              <View>
                <PanelTitle>TIME</PanelTitle>
                <View className="flex-row flex-wrap gap-1.5">
                  {["09:00", "12:00", "15:00", "18:00", "21:00"].map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setCTime(t)}
                      className={`rounded-pill px-3 py-[6px] ${cTime === t ? "bg-accent" : "bg-chip hover:bg-elev"}`}
                    >
                      <Text className={`text-[12.5px] font-semibold ${cTime === t ? "text-on-accent" : "text-ink-2"}`}>
                        {formatTime12(t)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ alignItems: Platform.OS === "web" ? "flex-start" : undefined }}>
                  <NoxDateTimePicker
                    value={customAt}
                    mode="time"
                    theme={theme}
                    textColor={c.ink}
                    onChange={(d) => setCTime(hhmm(d))}
                  />
                </View>
              </View>
              <View>
                <Pressable
                  onPress={() => onChange([...reminders, customAt.toISOString()])}
                  disabled={customPast || customDup}
                  accessibilityRole="button"
                  className={`flex-row items-center justify-center gap-1.5 rounded-[10px] py-2.5 ${
                    customPast || customDup ? "bg-chip" : "bg-accent hover:opacity-90"
                  }`}
                >
                  <Plus size={14} color={customPast || customDup ? c.ink3 : c.onAccent} strokeWidth={2.4} />
                  <Text className={`text-[13.5px] font-bold ${customPast || customDup ? "text-ink-3" : "text-on-accent"}`}>
                    Add {reminderText(customAt.toISOString(), today)}
                  </Text>
                </Pressable>
                {customPast ? (
                  <Text className="text-high mt-1.5 text-center text-[11.5px]">That time has already passed.</Text>
                ) : customDup ? (
                  <Text className="text-ink-3 mt-1.5 text-center text-[11.5px]">Already set.</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/* ─────────────────────────────── the bar ─────────────────────────────── */

const TIME_PRESETS: { label: string; value: string }[] = [
  { label: "Morning", value: "09:00" },
  { label: "Midday", value: "12:00" },
  { label: "Afternoon", value: "15:00" },
  { label: "Evening", value: "18:00" },
  { label: "Night", value: "21:00" },
];

export function PropertyBar({
  value,
  onChange,
  today,
  compact,
  /** Horizontal inset for the bar and panels, to line up with the surrounding content. */
  inset = 20,
  autoFields,
  trailing,
}: {
  value: TaskProps;
  onChange: (patch: Partial<TaskProps>) => void;
  today: string;
  compact: boolean;
  inset?: number;
  /** Fields whose value was read from the typed title (sparkle on their button). */
  autoFields?: ReadonlySet<string>;
  /** Extra controls at the end of the bar. */
  trailing?: ReactNode;
}) {
  const c = useThemeColors();
  const theme = usePrefs((s) => s.theme);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [customTime, setCustomTime] = useState(false);
  const { date, time, reminders, repeat, priority } = value;
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  // Esc closes an open panel before anything else hears it, so in the dialog the first Esc folds the
  // panel and only the second closes the dialog. Both halves of the key need catching: our dialog
  // listens for keydown, but react-native-web's Modal closes itself on keyup. Window capture runs
  // before any listener on document.
  const swallowEscUp = useRef(false);
  const panelOpen = useRef(false);
  panelOpen.current = panel !== null;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !panelOpen.current) return;
      e.preventDefault();
      e.stopPropagation();
      swallowEscUp.current = true;
      setPanel(null);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !swallowEscUp.current) return;
      e.stopPropagation();
      swallowEscUp.current = false;
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
  }, []);

  // Clearing the date clears what hangs off it; a repeat needs a day, so it supplies one.
  const setDate = (next: string | null) =>
    onChange(next === null ? { date: null, time: null, repeat: { kind: "none", weekdays: [] } } : { date: next });
  const setRepeat = (r: RepeatValue) => onChange(r.kind !== "none" && date === null ? { repeat: r, date: today } : { repeat: r });

  const priorityColors = { high: c.high, medium: c.medium, low: c.ink3 };
  const dow = dayOfWeek(today);
  const quickDates: { key: string | null; label: string; hint: string }[] = [
    { key: today, label: "Today", hint: WEEKDAY_SHORT[dow]! },
    { key: addDays(today, 1), label: "Tomorrow", hint: WEEKDAY_SHORT[(dow + 1) % 7]! },
    { key: dow === 0 ? today : addDays(today, 6 - dow), label: "This weekend", hint: dow === 0 ? "Sun" : "Sat" },
    { key: addDays(today, ((8 - dow) % 7) || 7), label: "Next week", hint: "Mon" },
    { key: null, label: "No date", hint: "" },
  ];

  const datePanel = (
    <View className={compact ? "gap-3" : "flex-row gap-4"}>
      <View style={compact ? undefined : { width: 210 }}>
        {quickDates.map((q) => (
          <OptionRow
            key={q.label}
            label={q.label}
            hint={q.hint}
            selected={date === q.key}
            onPress={() => {
              setDate(q.key);
              setPanel(null);
            }}
          />
        ))}
      </View>
      <View className={compact ? "" : "border-line flex-1 border-l pl-4"}>
        <MiniCalendar
          selected={date}
          today={today}
          onSelect={(k) => {
            setDate(k);
            setPanel(null);
          }}
        />
      </View>
    </View>
  );

  const isPresetTime = time !== null && TIME_PRESETS.some((t) => t.value === time);
  const timePanel = (
    <View>
      <View className="flex-row flex-wrap gap-1.5">
        {TIME_PRESETS.map((t) => (
          <PresetCard
            key={t.value}
            title={t.label}
            sub={formatTime12(t.value)!}
            selected={time === t.value}
            onPress={() => {
              onChange({ time: t.value });
              setCustomTime(false);
              setPanel(null);
            }}
          />
        ))}
      </View>
      <View className="mt-2">
        <OptionRow
          label="Custom time…"
          selected={customTime || (time !== null && !isPresetTime)}
          hint={time && !isPresetTime ? formatTime12(time)! : ""}
          onPress={() => {
            setCustomTime(true);
            if (time === null) onChange({ time: "09:00" });
          }}
        />
        {customTime && date && (
          <NoxDateTimePicker
            value={localDate(date, time ?? "09:00")}
            mode="time"
            theme={theme}
            textColor={c.ink}
            onChange={(d) => onChange({ time: hhmm(d) })}
          />
        )}
        <OptionRow
          label="All day (no time)"
          selected={time === null}
          onPress={() => {
            onChange({ time: null });
            setCustomTime(false);
            setPanel(null);
          }}
        />
      </View>
    </View>
  );

  const anchorDow = dayOfWeek(date ?? today);
  const repeatPanel = (
    <View>
      {(
        [
          ["none", "Never"],
          ["daily", "Every day"],
          ["weekdays", "Every weekday", "Mon–Fri"],
          ["weekly", "Every week", `on ${WEEKDAY_SHORT[anchorDow]}`],
          ["custom", "Custom days…"],
        ] as [RepeatKind, string, string?][]
      ).map(([kind, label, hint]) => (
        <OptionRow
          key={kind}
          label={label}
          hint={hint}
          selected={repeat.kind === kind}
          onPress={() => {
            setRepeat({ kind, weekdays: kind === "custom" ? (repeat.weekdays.length ? repeat.weekdays : [anchorDow]) : [] });
            if (kind !== "custom") setPanel(null);
          }}
        />
      ))}
      {repeat.kind === "custom" && (
        <View className="mt-2 flex-row justify-between px-1.5">
          {WEEKDAY_LETTERS.map((letter, d) => {
            const on = repeat.weekdays.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() =>
                  setRepeat({
                    kind: "custom",
                    weekdays: on ? repeat.weekdays.filter((x) => x !== d) : [...repeat.weekdays, d].sort((a, b) => a - b),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={WEEKDAY_SHORT[d]}
                accessibilityState={{ selected: on }}
                className={`h-9 w-9 items-center justify-center rounded-full ${on ? "bg-accent" : "bg-chip hover:bg-elev"}`}
              >
                <Text className={`text-[13px] font-semibold ${on ? "text-on-accent" : "text-ink-2"}`}>{letter}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {repeat.kind === "custom" && repeat.weekdays.length === 0 && (
        <Text className="text-high mt-2 px-2.5 text-[11.5px]">Pick at least one day.</Text>
      )}
    </View>
  );

  const priorityPanel = (
    <View>
      {(["high", "medium", "low"] as const).map((p) => (
        <OptionRow
          key={p}
          label={cap(p)}
          selected={priority === p}
          icon={<Flag size={14} color={priorityColors[p]} strokeWidth={2} fill={priority === p ? priorityColors[p] : "transparent"} />}
          onPress={() => {
            onChange({ priority: p });
            setPanel(null);
          }}
        />
      ))}
    </View>
  );

  const remindLabel = reminders.length === 0 ? "Remind" : reminders.length === 1 ? "1 reminder" : `${reminders.length} reminders`;

  const buttons = (
    <>
      <PropButton
        icon={Calendar}
        label={date ? dateLabel(date, today) : "Date"}
        set={date !== null}
        auto={autoFields?.has("date")}
        open={panel === "date"}
        onPress={() => toggle("date")}
        onClear={() => setDate(null)}
      />
      {date !== null && (
        <PropButton
          icon={Clock}
          label={time ? formatTime12(time)! : "Time"}
          set={time !== null}
          auto={autoFields?.has("time")}
          open={panel === "time"}
          onPress={() => toggle("time")}
          onClear={() => onChange({ time: null })}
        />
      )}
      <PropButton
        icon={Bell}
        label={remindLabel}
        set={reminders.length > 0}
        open={panel === "remind"}
        onPress={() => toggle("remind")}
        onClear={() => onChange({ reminders: [] })}
      />
      <PropButton
        icon={Repeat}
        label={repeatLabel(repeat, date)}
        set={repeat.kind !== "none"}
        auto={autoFields?.has("repeat")}
        open={panel === "repeat"}
        onPress={() => toggle("repeat")}
        onClear={() => setRepeat({ kind: "none", weekdays: [] })}
      />
      <PropButton
        icon={Flag}
        label={priority === "medium" ? "Priority" : cap(priority)}
        set={priority !== "medium"}
        auto={autoFields?.has("priority")}
        color={priority === "medium" ? undefined : priorityColors[priority]}
        open={panel === "priority"}
        onPress={() => toggle("priority")}
      />
    </>
  );

  const panels: Record<Panel, ReactNode> = {
    date: datePanel,
    time: timePanel,
    remind: (
      <RemindPanel
        date={date}
        time={time}
        reminders={reminders}
        today={today}
        compact={compact}
        onChange={(next) => onChange({ reminders: next })}
      />
    ),
    repeat: repeatPanel,
    priority: priorityPanel,
  };

  return (
    <View>
      {/* Wraps rather than scrolling sideways: a sideways row hid Repeat and Priority off the edge
          on phones, with nothing to say they were there. */}
      <View className="flex-row flex-wrap items-center gap-1" style={{ paddingHorizontal: inset - 6 }}>
        {buttons}
        {trailing}
      </View>
      {panel && (
        <View className="border-line bg-bg/40 mt-3 rounded-[12px] border p-2.5" style={{ marginHorizontal: inset - 8 }}>
          {panels[panel]}
        </View>
      )}
    </View>
  );
}
