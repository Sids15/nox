import { useThemeColors } from "@nox/features";
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
import {
  Bell,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Plus,
  Repeat,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { MenuDivider, MenuLabel, MenuRow, pressScale, TABULAR } from "../menu";
import { Popover } from "../popover";
import { MiniCalendar } from "./mini-calendar";
import { TimePicker } from "./time-picker";

/**
 * The task property bar — Date · Time · Remind · Repeat · Priority — shared by the new-task dialog and
 * the task editor so both look and behave the same. Each property is a compact button showing its
 * value; tapping one opens its options in a menu anchored to the button (Linear / Todoist), floating
 * over the surface instead of growing it. Purely controlled: it reports a patch through
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
 * A property button. Unset properties are quiet — icon and name, a fill only on hover — so the bar
 * reads as the few values that are set. Set ones carry a tinted fill; `auto` adds a sparkle when the
 * value came from the typed title. The clear × is its own 32px target beside the button, not nested
 * inside it.
 */
function PropButton({
  anchorRef,
  icon: Icon,
  label,
  set,
  open,
  color,
  auto,
  onPress,
  onClear,
}: {
  anchorRef: RefObject<View | null>;
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
  const tint = color ?? c.accent;
  const active = set || open;
  return (
    <View
      ref={anchorRef}
      collapsable={false}
      className={`h-[32px] flex-row items-center rounded-[9px] ${
        open ? "bg-accent/[0.16]" : set ? "bg-accent/[0.09]" : ""
      }`}
      style={color && set ? { backgroundColor: `${color}1a` } : undefined}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={pressScale}
        className={`h-full flex-row items-center gap-1.5 rounded-[9px] pl-2.5 ${set && onClear ? "pr-1" : "pr-2.5"} ${
          active ? "" : "hover:bg-chip"
        }`}
      >
        <Icon size={14} color={active ? tint : c.ink3} strokeWidth={2} />
        <Text style={{ color: active ? tint : c.ink2 }} className="text-[13px] font-semibold">
          {label}
        </Text>
        {auto && <Sparkles size={11} color={tint} strokeWidth={2.2} />}
      </Pressable>
      {set && onClear && (
        <Pressable
          onPress={onClear}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
          style={pressScale}
          className="h-full w-[26px] items-center justify-center rounded-[9px] hover:bg-black/10"
        >
          <X size={12} color={tint} strokeWidth={2.4} />
        </Pressable>
      )}
    </View>
  );
}

/** A square check for multi-select rows (reminders), distinct from the single-select tick. */
function CheckBox({ on }: { on: boolean }) {
  const c = useThemeColors();
  return (
    <View
      className={`h-[16px] w-[16px] items-center justify-center rounded-[4px] ${on ? "bg-accent" : "border-ink-3 border-[1.5px]"}`}
    >
      {on && <Check size={11} color={c.onAccent} strokeWidth={3} />}
    </View>
  );
}

/* ─────────────────────────────── remind menu ─────────────────────────────── */

/**
 * Reminders, as a menu: presets for this task's date and time as checkable rows (any number of them;
 * past ones disabled since they could never fire), any custom reminders already set with a remove
 * button, and "Custom date & time…" which swaps the menu to a calendar + time view. A task with no
 * date goes straight to the custom view.
 */
function RemindMenu({
  date,
  time,
  reminders,
  today,
  onChange,
}: {
  date: string | null;
  time: string | null;
  reminders: string[];
  today: string;
  onChange: (next: string[]) => void;
}) {
  const c = useThemeColors();
  const now = Date.now();
  const presets = reminderPresets(date, time);
  const [custom, setCustom] = useState(presets.length === 0);
  const [cDate, setCDate] = useState<string>(date ?? today);
  const [cTime, setCTime] = useState<string>(time ?? "09:00");

  const isPreset = (iso: string) => presets.some((p) => sameMinute(p.at.toISOString(), iso));
  const others = [...reminders].filter((r) => !isPreset(r)).sort();
  const toggle = (at: Date) => {
    const iso = at.toISOString();
    onChange(reminders.some((r) => sameMinute(r, iso)) ? reminders.filter((r) => !sameMinute(r, iso)) : [...reminders, iso]);
  };

  if (custom) {
    const at = localDate(cDate, cTime);
    const past = at.getTime() <= now;
    const dup = reminders.some((r) => sameMinute(r, at.toISOString()));
    const blocked = past || dup;
    return (
      <View className="p-1.5">
        <View className="flex-row items-center gap-1 pb-1">
          {presets.length > 0 && (
            <Pressable
              onPress={() => setCustom(false)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Back to reminders"
              className="hover:bg-chip h-7 w-7 items-center justify-center rounded-full"
            >
              <ChevronLeft size={16} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
          )}
          <Text className="text-ink px-1 text-[13.5px] font-semibold">Remind me at…</Text>
        </View>
        <View className="px-1.5 pt-1">
          <MiniCalendar selected={cDate} today={today} onSelect={setCDate} />
        </View>
        <MenuDivider />
        <View className="px-1.5">
          <TimePicker value={cTime} onChange={(t) => t && setCTime(t)} compact allowNone={false} />
        </View>
        <View className="px-1.5 pb-1 pt-3">
          <Pressable
            onPress={() => {
              onChange([...reminders, at.toISOString()]);
              if (presets.length > 0) setCustom(false);
            }}
            disabled={blocked}
            accessibilityRole="button"
            style={pressScale}
            className={`h-[38px] flex-row items-center justify-center gap-1.5 rounded-[9px] ${blocked ? "bg-chip" : "bg-accent hover:opacity-90"}`}
          >
            <Plus size={14} color={blocked ? c.ink3 : c.onAccent} strokeWidth={2.4} />
            <Text className={`text-[13.5px] font-semibold ${blocked ? "text-ink-3" : "text-on-accent"}`}>
              {past ? "That time has passed" : dup ? "Already set" : `Remind ${reminderText(at.toISOString(), today)}`}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="p-1.5">
      <MenuLabel>{time ? `Before ${formatTime12(time)}` : "On an all-day task"}</MenuLabel>
      {presets.map((p) => {
        const on = reminders.some((r) => sameMinute(r, p.at.toISOString()));
        const sub =
          toDateKey(p.at) === date ? formatTime12(hhmm(p.at))! : `${WEEKDAY_SHORT[p.at.getDay()]} ${formatTime12(hhmm(p.at))}`;
        return (
          <MenuRow
            key={p.label}
            label={p.label}
            hint={sub}
            selected={on}
            disabled={!on && p.at.getTime() <= now}
            icon={<CheckBox on={on} />}
            trailing={<View />}
            onPress={() => toggle(p.at)}
          />
        );
      })}
      {others.length > 0 && (
        <>
          <MenuDivider />
          <MenuLabel>Custom</MenuLabel>
          {others.map((iso) => {
            const past = new Date(iso).getTime() <= now;
            return (
              <View key={iso} className="min-h-[36px] flex-row items-center gap-2.5 rounded-[8px] px-2.5">
                <Bell size={14} color={past ? c.ink3 : c.accent} strokeWidth={2} />
                <Text style={TABULAR} className={`flex-1 text-[13.5px] ${past ? "text-ink-3 line-through" : "text-ink"}`}>
                  {reminderText(iso, today)}
                </Text>
                <Pressable
                  onPress={() => onChange(reminders.filter((r) => r !== iso))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove reminder ${reminderText(iso, today)}`}
                  className="hover:bg-chip h-7 w-7 items-center justify-center rounded-full"
                >
                  <X size={13} color={c.ink3} strokeWidth={2.2} />
                </Pressable>
              </View>
            );
          })}
        </>
      )}
      <MenuDivider />
      <MenuRow
        label="Custom date & time…"
        icon={<Plus size={14} color={c.ink2} strokeWidth={2.2} />}
        trailing={<ChevronRight size={14} color={c.ink3} strokeWidth={2} />}
        onPress={() => setCustom(true)}
      />
    </View>
  );
}

/* ─────────────────────────────── the bar ─────────────────────────────── */

const MENU_WIDTH: Record<Panel, number> = { date: 500, time: 470, remind: 340, repeat: 280, priority: 220 };

export function PropertyBar({
  value,
  onChange,
  today,
  compact,
  /** Horizontal inset for the bar, to line up with the surrounding content. */
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
  const [panel, setPanel] = useState<Panel | null>(null);
  const { date, time, reminders, repeat, priority } = value;
  const refs = {
    date: useRef<View>(null),
    time: useRef<View>(null),
    remind: useRef<View>(null),
    repeat: useRef<View>(null),
    priority: useRef<View>(null),
  };
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const close = () => setPanel(null);

  // Esc closes an open menu before anything else hears it, so in the dialog the first Esc folds the
  // menu and only the second closes the dialog. Both halves of the key are caught: the dialog listens
  // for keydown, but react-native-web's Modal closes on keyup. Window capture runs first.
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
  const narrow = compact;

  const dateMenu = (
    <View className={`p-1.5 ${narrow ? "" : "flex-row"}`}>
      <View style={narrow ? undefined : { width: 196 }}>
        {quickDates.map((q) => (
          <MenuRow
            key={q.label}
            label={q.label}
            hint={q.hint}
            selected={date === q.key}
            onPress={() => {
              setDate(q.key);
              close();
            }}
          />
        ))}
      </View>
      {narrow ? <MenuDivider /> : <View className="bg-line mx-1.5 w-px" />}
      <View className="flex-1 px-2 py-1">
        <MiniCalendar
          selected={date}
          today={today}
          onSelect={(k) => {
            setDate(k);
            close();
          }}
        />
      </View>
    </View>
  );

  const timeMenu = (
    <View className="p-2.5">
      <TimePicker
        value={time}
        compact={narrow}
        onChange={(t) => {
          onChange({ time: t });
          close();
        }}
      />
    </View>
  );

  const anchorDow = dayOfWeek(date ?? today);
  const repeatMenu = (
    <View className="p-1.5">
      {(
        [
          ["none", "Never"],
          ["daily", "Every day"],
          ["weekdays", "Every weekday", "Mon–Fri"],
          ["weekly", "Every week", `on ${WEEKDAY_SHORT[anchorDow]}`],
          ["custom", "On certain days…"],
        ] as [RepeatKind, string, string?][]
      ).map(([kind, label, hint]) => (
        <MenuRow
          key={kind}
          label={label}
          hint={hint}
          selected={repeat.kind === kind}
          onPress={() => {
            setRepeat({ kind, weekdays: kind === "custom" ? (repeat.weekdays.length ? repeat.weekdays : [anchorDow]) : [] });
            if (kind !== "custom") close();
          }}
        />
      ))}
      {repeat.kind === "custom" && (
        <>
          <MenuDivider />
          <View className="flex-row justify-between px-1.5 pb-1 pt-0.5">
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
                  style={pressScale}
                  className={`h-8 w-8 items-center justify-center rounded-full ${on ? "bg-accent" : "hover:bg-chip"}`}
                >
                  <Text className={`text-[12.5px] font-semibold ${on ? "text-on-accent" : "text-ink-2"}`}>{letter}</Text>
                </Pressable>
              );
            })}
          </View>
          {repeat.weekdays.length === 0 && <Text className="text-high px-2.5 pb-1.5 text-[11.5px]">Pick at least one day.</Text>}
        </>
      )}
    </View>
  );

  const priorityMenu = (
    <View className="p-1.5">
      {(["high", "medium", "low"] as const).map((p) => (
        <MenuRow
          key={p}
          label={cap(p)}
          selected={priority === p}
          icon={<Flag size={14} color={priorityColors[p]} strokeWidth={2} fill={priority === p ? priorityColors[p] : "transparent"} />}
          onPress={() => {
            onChange({ priority: p });
            close();
          }}
        />
      ))}
    </View>
  );

  const menus: Record<Panel, ReactNode> = {
    date: dateMenu,
    time: timeMenu,
    remind: (
      <RemindMenu date={date} time={time} reminders={reminders} today={today} onChange={(next) => onChange({ reminders: next })} />
    ),
    repeat: repeatMenu,
    priority: priorityMenu,
  };
  const menuNames: Record<Panel, string> = { date: "Date", time: "Time", remind: "Reminders", repeat: "Repeat", priority: "Priority" };

  const remindLabel = reminders.length === 0 ? "Remind" : reminders.length === 1 ? "1 reminder" : `${reminders.length} reminders`;

  return (
    <View>
      <View className="flex-row flex-wrap items-center gap-1" style={{ paddingHorizontal: inset - 6 }}>
        <PropButton
          anchorRef={refs.date}
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
            anchorRef={refs.time}
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
          anchorRef={refs.remind}
          icon={Bell}
          label={remindLabel}
          set={reminders.length > 0}
          open={panel === "remind"}
          onPress={() => toggle("remind")}
          onClear={() => onChange({ reminders: [] })}
        />
        <PropButton
          anchorRef={refs.repeat}
          icon={Repeat}
          label={repeatLabel(repeat, date)}
          set={repeat.kind !== "none"}
          auto={autoFields?.has("repeat")}
          open={panel === "repeat"}
          onPress={() => toggle("repeat")}
          onClear={() => setRepeat({ kind: "none", weekdays: [] })}
        />
        <PropButton
          anchorRef={refs.priority}
          icon={Flag}
          label={priority === "medium" ? "Priority" : cap(priority)}
          set={priority !== "medium"}
          auto={autoFields?.has("priority")}
          color={priority === "medium" ? undefined : priorityColors[priority]}
          open={panel === "priority"}
          onPress={() => toggle("priority")}
        />
        {trailing}
      </View>

      {panel && (
        <Popover
          anchorRef={refs[panel]}
          open
          onClose={close}
          width={narrow && (panel === "date" || panel === "time") ? 360 : MENU_WIDTH[panel]}
          accessibilityLabel={menuNames[panel]}
        >
          {menus[panel]}
        </Popover>
      )}
    </View>
  );
}
