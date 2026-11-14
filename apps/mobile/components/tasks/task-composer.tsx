import { parseQuickAdd, useCreateTask, usePrefs, useThemeColors, type QuickAddField } from "@nox/features";
import type { Task, TaskInput } from "@nox/types";
import {
  addDays,
  capitalize as cap,
  dayOfMonth,
  dayOfWeek,
  formatTime12,
  monthShort,
  relativeDayLabel,
  todayKey,
  weekdayShort,
} from "@nox/utils";
import {
  Bell,
  Calendar,
  Check,
  Clock,
  CornerDownLeft,
  Flag,
  Repeat,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { NoxDateTimePicker } from "../date-time-picker";
import { MiniCalendar } from "./mini-calendar";

/* ─────────────────────────────── model ─────────────────────────────── */

type Panel = "date" | "time" | "remind" | "repeat" | "priority";
type RepeatKind = Task["repeat"];

/** Reminders relative to the due time, so they mean the same thing whatever day is picked. */
type ReminderKey = "at" | "10m" | "1h" | "1d" | "morning" | "eve";
const TIMED_REMINDERS: { key: ReminderKey; label: string }[] = [
  { key: "at", label: "At time of task" },
  { key: "10m", label: "10 minutes before" },
  { key: "1h", label: "1 hour before" },
  { key: "1d", label: "1 day before" },
];
const ALLDAY_REMINDERS: { key: ReminderKey; label: string }[] = [
  { key: "morning", label: "9:00 AM on the day" },
  { key: "eve", label: "6:00 PM the day before" },
];

const TIME_PRESETS: { label: string; value: string }[] = [
  { label: "Morning", value: "09:00" },
  { label: "Midday", value: "12:00" },
  { label: "Afternoon", value: "15:00" },
  { label: "Evening", value: "18:00" },
  { label: "Night", value: "21:00" },
];

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDate(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const [h, min] = time.split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function reminderAt(key: ReminderKey, date: string, time: string | null): Date {
  const base = time ?? "09:00";
  switch (key) {
    case "at":
      return localDate(date, base);
    case "10m":
      return new Date(localDate(date, base).getTime() - 10 * 60_000);
    case "1h":
      return new Date(localDate(date, base).getTime() - 60 * 60_000);
    case "1d":
      return localDate(addDays(date, -1), base);
    case "morning":
      return localDate(date, "09:00");
    case "eve":
      return localDate(addDays(date, -1), "18:00");
  }
}

/** "Today", "Tomorrow", "Mon 16", "Sat 2 Jan" — a short label for a due date. */
function dateLabel(key: string, today: string): string {
  const rel = relativeDayLabel(key, today);
  if (rel === "today" || rel === "tomorrow" || rel === "yesterday") return cap(rel);
  const wd = cap(weekdayShort(key).toLowerCase());
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  const month = cap(monthShort(key).toLowerCase());
  return sameYear ? `${wd} ${dayOfMonth(key)} ${month}` : `${dayOfMonth(key)} ${month} ${key.slice(0, 4)}`;
}

function repeatLabel(kind: RepeatKind, weekdays: number[], anchor: string | null): string {
  switch (kind) {
    case "none":
      return "Repeat";
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return anchor ? `Every ${WEEKDAY_SHORT[dayOfWeek(anchor)]}` : "Weekly";
    case "custom":
      return weekdays.length ? weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ") : "Custom";
  }
}

/* ─────────────────────────────── pieces ─────────────────────────────── */

/** A property button in the bar: icon + current value. Accent-tinted when set, open when its panel is. */
function PropButton({
  icon: Icon,
  label,
  set,
  open,
  disabled,
  color,
  onPress,
  onClear,
}: {
  icon: LucideIcon;
  label: string;
  set: boolean;
  open: boolean;
  disabled?: boolean;
  color?: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  const c = useThemeColors();
  const tint = color ?? (set ? c.accent : c.ink2);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open, disabled }}
      className={`rounded-[9px] flex-row items-center gap-1.5 border px-2.5 py-[7px] ${
        open
          ? "border-accent/[0.6] bg-accent/[0.14]"
          : set
            ? "border-accent/[0.25] bg-accent/[0.08] hover:bg-accent/[0.14]"
            : "border-line hover:bg-chip"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <Icon size={14} color={tint} strokeWidth={2} />
      <Text style={{ color: set || open ? tint : c.ink2 }} className="text-[13px] font-semibold">
        {label}
      </Text>
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

/** One option row in a panel: optional icon, label, right-hand hint, check when selected. */
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
    <Text className="text-ink-3 mb-1.5 px-2.5 font-mono text-[10px] font-semibold tracking-[0.14em]">{children}</Text>
  );
}

/* ─────────────────────────────── composer ─────────────────────────────── */

/**
 * Quick-add composer for a new task, used inside NewTaskDialog (a centred dialog on desktop, a bottom
 * sheet on phones). Modelled on the quick-add flows of Todoist, Linear and Things:
 *
 * - The title leads; type naturally — "Call mum tomorrow 6pm !high" — and the date, time and priority
 *   are recognised (parseQuickAdd), previewed under the title, and stripped from the saved title.
 *   "Keep as text" turns recognition off for this task.
 * - Every other property is a compact button in one bar showing its current value; each opens its own
 *   options panel (calendar + quick dates, time presets, reminders, repeat, priority). A value picked
 *   by hand always beats one recognised from the text.
 * - Nothing is written until Add. "Create more" keeps the composer open with the same settings for
 *   entering a run of tasks.
 */
export function TaskComposer({
  initialDate,
  onClose,
  compact,
}: {
  /** Day the task starts on — the day focused in the Tasks week strip. */
  initialDate: string;
  onClose: () => void;
  /** Phone layout: horizontally scrolling property bar, stacked panels. */
  compact: boolean;
}) {
  const c = useThemeColors();
  const theme = usePrefs((s) => s.theme);
  const createTask = useCreateTask();
  const today = todayKey();

  const [raw, setRaw] = useState("");
  const [description, setDescription] = useState("");
  const [parsing, setParsing] = useState(true);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [createMore, setCreateMore] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState(false);

  // Values picked by hand. `undefined` = not touched, so the recognised/default value applies.
  const [manDate, setManDate] = useState<string | null | undefined>(undefined);
  const [manTime, setManTime] = useState<string | null | undefined>(undefined);
  const [manPriority, setManPriority] = useState<Task["priority"] | undefined>(undefined);
  const [manRepeat, setManRepeat] = useState<{ kind: RepeatKind; weekdays: number[] } | undefined>(undefined);
  const [reminders, setReminders] = useState<ReminderKey[]>([]);

  const titleRef = useRef<TextInput>(null);

  const parsed = useMemo(
    () => (parsing ? parseQuickAdd(raw, today) : { title: raw.trim(), matched: [] }),
    [raw, parsing, today],
  );
  const recognised = (field: QuickAddField) => parsed.matched.some((m) => m.field === field);

  // Effective values: by hand > recognised from the title > default.
  const repeat = manRepeat ?? (parsed.repeat ? { kind: parsed.repeat.kind, weekdays: parsed.repeat.weekdays ?? [] } : { kind: "none" as RepeatKind, weekdays: [] });
  let date: string | null = manDate !== undefined ? manDate : (parsed.date ?? initialDate);
  if (repeat.kind !== "none" && date === null) date = today; // a repeat needs a day to hang off
  const time = date === null ? null : manTime !== undefined ? manTime : (parsed.time ?? null);
  const priority = manPriority ?? parsed.priority ?? "medium";
  const reminderOpts = time ? TIMED_REMINDERS : ALLDAY_REMINDERS;
  const activeReminders = date ? reminders.filter((r) => reminderOpts.some((o) => o.key === r)) : [];

  const title = parsed.title;
  const canAdd = title.length > 0;

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  // Esc closes the open panel first, then the composer (web / desktop).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (panel) setPanel(null);
        else onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 3500);
    return () => clearTimeout(t);
  }, [added]);

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  const submit = () => {
    if (!canAdd) {
      titleRef.current?.focus();
      return;
    }
    if (repeat.kind === "custom" && repeat.weekdays.length === 0) {
      setPanel("repeat");
      return;
    }
    const now = Date.now();
    const reminderTimes = date
      ? activeReminders
          .map((k) => reminderAt(k, date!, time))
          .filter((d) => d.getTime() > now) // a reminder already in the past would never fire
          .sort((a, b) => a.getTime() - b.getTime())
          .map((d) => d.toISOString())
      : [];
    const input: TaskInput = {
      title: title.slice(0, 200),
      notes: description.trim() ? description.trim().slice(0, 2000) : null,
      due_date: date,
      due_time: time,
      reminder_times: reminderTimes,
      priority,
      repeat: repeat.kind,
      repeat_config: repeat.kind === "custom" ? { weekdays: repeat.weekdays } : null,
    };
    createTask.create(input);

    if (!createMore) {
      onClose();
      return;
    }
    // Create more: keep the settings, clear the words, go again.
    setAdded(title);
    setRaw("");
    setDescription("");
    setParsing(true);
    setPanel(null);
    // After the re-render: on web, submitting blurs the field before the clear lands.
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const priorityColor = { high: c.high, medium: c.medium, low: c.ink3 }[priority];

  /* ── panels ── */

  const quickDates: { key: string | null; label: string; hint: string }[] = [
    { key: today, label: "Today", hint: WEEKDAY_SHORT[dayOfWeek(today)]! },
    { key: addDays(today, 1), label: "Tomorrow", hint: WEEKDAY_SHORT[dayOfWeek(addDays(today, 1))]! },
    // Saturday, or today if the weekend has already started.
    {
      key: dayOfWeek(today) === 0 ? today : addDays(today, 6 - dayOfWeek(today)),
      label: "This weekend",
      hint: dayOfWeek(today) === 0 ? "Sun" : "Sat",
    },
    { key: addDays(today, ((8 - dayOfWeek(today)) % 7) || 7), label: "Next week", hint: "Mon" },
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
            selected={date === q.key && (q.key !== null || repeat.kind === "none")}
            onPress={() => {
              setManDate(q.key);
              if (q.key === null) setManRepeat({ kind: "none", weekdays: [] });
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
            setManDate(k);
            setPanel(null);
          }}
        />
      </View>
    </View>
  );

  const timePanel = (
    <View>
      <View className="flex-row flex-wrap gap-1.5 px-1">
        {TIME_PRESETS.map((t) => {
          const on = time === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => {
                setManTime(t.value);
                setCustomTime(false);
                setPanel(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              className={`min-w-[96px] flex-1 rounded-[10px] border px-3 py-2 ${on ? "border-accent bg-accent/[0.12]" : "border-line hover:bg-chip"}`}
            >
              <Text className={`text-[12px] font-semibold ${on ? "text-accent" : "text-ink-3"}`}>{t.label}</Text>
              <Text className={`mt-0.5 text-[14px] font-bold ${on ? "text-accent" : "text-ink"}`}>{formatTime12(t.value)}</Text>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2">
        <OptionRow
          label="Custom time…"
          selected={customTime || (time !== null && !TIME_PRESETS.some((t) => t.value === time))}
          hint={time && !TIME_PRESETS.some((t) => t.value === time) ? formatTime12(time)! : ""}
          onPress={() => {
            setCustomTime(true);
            if (time === null) setManTime("09:00");
          }}
        />
        {customTime && date && (
          <NoxDateTimePicker
            value={localDate(date, time ?? "09:00")}
            mode="time"
            theme={theme}
            textColor={c.ink}
            onChange={(d) =>
              setManTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`)
            }
          />
        )}
        <OptionRow
          label="All day (no time)"
          selected={time === null}
          onPress={() => {
            setManTime(null);
            setCustomTime(false);
            setPanel(null);
          }}
        />
      </View>
    </View>
  );

  const remindPanel = (
    <View>
      <PanelTitle>{time ? `BEFORE ${formatTime12(time)!.toUpperCase()}` : "ALL-DAY TASK"}</PanelTitle>
      {reminderOpts.map((r) => (
        <OptionRow
          key={r.key}
          label={r.label}
          selected={activeReminders.includes(r.key)}
          onPress={() => setReminders((cur) => (cur.includes(r.key) ? cur.filter((k) => k !== r.key) : [...cur, r.key]))}
        />
      ))}
      {!time && (
        <Text className="text-ink-3 mt-1.5 px-2.5 text-[11.5px]">Set a time to remind relative to it.</Text>
      )}
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
          ["weekly", `Every week`, `on ${WEEKDAY_SHORT[anchorDow]}`],
          ["custom", "Custom days…"],
        ] as [RepeatKind, string, string?][]
      ).map(([kind, label, hint]) => (
        <OptionRow
          key={kind}
          label={label}
          hint={hint}
          selected={repeat.kind === kind}
          onPress={() => {
            setManRepeat({ kind, weekdays: kind === "custom" ? (repeat.weekdays.length ? repeat.weekdays : [anchorDow]) : [] });
            if (kind !== "custom") setPanel(null);
          }}
        />
      ))}
      {repeat.kind === "custom" && (
        <View className="mt-2 flex-row justify-between px-1.5">
          {WEEKDAY_LETTERS.map((letter, dow) => {
            const on = repeat.weekdays.includes(dow);
            return (
              <Pressable
                key={dow}
                onPress={() =>
                  setManRepeat({
                    kind: "custom",
                    weekdays: on ? repeat.weekdays.filter((d) => d !== dow) : [...repeat.weekdays, dow].sort((a, b) => a - b),
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={WEEKDAY_SHORT[dow]}
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
          icon={<Flag size={14} color={{ high: c.high, medium: c.medium, low: c.ink3 }[p]} strokeWidth={2} fill={priority === p ? { high: c.high, medium: c.medium, low: c.ink3 }[p] : "transparent"} />}
          onPress={() => {
            setManPriority(p);
            setPanel(null);
          }}
        />
      ))}
    </View>
  );

  const panels: Record<Panel, ReactNode> = {
    date: datePanel,
    time: timePanel,
    remind: remindPanel,
    repeat: repeatPanel,
    priority: priorityPanel,
  };

  /* ── layout ── */

  const remindLabel =
    activeReminders.length === 0
      ? "Remind"
      : activeReminders.length === 1
        ? reminderOpts.find((o) => o.key === activeReminders[0])!.label.replace(" of task", "")
        : `${activeReminders.length} reminders`;

  const propBar = (
    <>
      <PropButton
        icon={Calendar}
        label={date ? dateLabel(date, today) : "Date"}
        set={date !== null}
        open={panel === "date"}
        onPress={() => toggle("date")}
        onClear={() => {
          setManDate(null);
          setManRepeat({ kind: "none", weekdays: [] });
        }}
      />
      <PropButton
        icon={Clock}
        label={time ? formatTime12(time)! : "Time"}
        set={time !== null}
        open={panel === "time"}
        disabled={date === null}
        onPress={() => toggle("time")}
        onClear={() => setManTime(null)}
      />
      <PropButton
        icon={Bell}
        label={remindLabel}
        set={activeReminders.length > 0}
        open={panel === "remind"}
        disabled={date === null}
        onPress={() => toggle("remind")}
        onClear={() => setReminders([])}
      />
      <PropButton
        icon={Repeat}
        label={repeatLabel(repeat.kind, repeat.weekdays, date)}
        set={repeat.kind !== "none"}
        open={panel === "repeat"}
        onPress={() => toggle("repeat")}
        onClear={() => setManRepeat({ kind: "none", weekdays: [] })}
      />
      <PropButton
        icon={Flag}
        label={cap(priority)}
        set={priority !== "medium"}
        color={priority === "medium" ? undefined : priorityColor}
        open={panel === "priority"}
        onPress={() => toggle("priority")}
      />
    </>
  );

  return (
    <View>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4">
        <Text className="text-ink-3 font-mono text-[10px] font-semibold tracking-[0.16em]">NEW TASK</Text>
        {!compact && (
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="hover:bg-chip -mr-1.5 h-7 w-7 items-center justify-center rounded-full"
          >
            <X size={15} color={c.ink3} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {/* Title + description */}
      <View className="px-5 pt-2">
        <TextInput
          ref={titleRef}
          value={raw}
          onChangeText={setRaw}
          onSubmitEditing={submit}
          // Keep the field focused on Enter so "Create more" can go straight into the next task.
          // react-native-web only honours the legacy blurOnSubmit; native reads submitBehavior.
          submitBehavior="submit"
          blurOnSubmit={false}
          returnKeyType="done"
          maxLength={240}
          placeholder="Task name"
          placeholderTextColor={c.ink3}
          accessibilityLabel="Task name"
          className="text-ink text-[19px] font-semibold tracking-[-0.01em]"
          style={{ paddingVertical: 0, minHeight: 28 }}
        />
        <AutoGrowInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor={c.ink3}
          maxLength={2000}
          minHeight={22}
          accessibilityLabel="Description"
          className="text-ink-2 mt-1 text-[14px] leading-[21px]"
          style={{ textAlignVertical: "top" }}
        />

        {/* What was recognised in the title — dismiss to keep the words as typed. */}
        {parsed.matched.length > 0 && (
          <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
            <Sparkles size={12} color={c.accent} strokeWidth={2} />
            {parsed.matched.map((m) => (
              <View key={m.field + m.text} className="bg-accent/[0.12] rounded-[6px] px-1.5 py-0.5">
                <Text className="text-accent font-mono text-[11px] font-semibold">{m.text}</Text>
              </View>
            ))}
            <Pressable onPress={() => setParsing(false)} hitSlop={6} accessibilityRole="button" className="ml-1">
              <Text className="text-ink-3 text-[11.5px] font-semibold underline">Keep as text</Text>
            </Pressable>
          </View>
        )}
        {!parsing && raw.trim().length > 0 && (
          <Pressable onPress={() => setParsing(true)} hitSlop={6} className="mt-2.5 self-start">
            <Text className="text-ink-3 text-[11.5px] font-semibold">
              Dates in the name are ignored · <Text className="text-accent">Recognise again</Text>
            </Text>
          </Pressable>
        )}
      </View>

      {/* Property bar */}
      {compact ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}
          className="mt-4"
        >
          {propBar}
        </ScrollView>
      ) : (
        <View className="mt-4 flex-row flex-wrap gap-1.5 px-5">{propBar}</View>
      )}

      {/* Options for the open property */}
      {panel && (
        <View className="border-line bg-bg/40 mx-3 mt-3 rounded-[12px] border p-2.5">{panels[panel]}</View>
      )}

      {/* Footer */}
      <View className="border-line mt-4 flex-row items-center gap-3 border-t px-4 py-3">
        <Pressable
          onPress={() => setCreateMore((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: createMore }}
          className="flex-row items-center gap-2"
          hitSlop={6}
        >
          <View
            style={{
              width: 30,
              height: 18,
              borderRadius: 99,
              padding: 2,
              alignItems: createMore ? "flex-end" : "flex-start",
              backgroundColor: createMore ? c.accent : c.chip,
              borderWidth: createMore ? 0 : 1,
              borderColor: c.line,
            }}
          >
            <View style={{ width: 14, height: 14, borderRadius: 99, backgroundColor: createMore ? "#fff" : c.ink3 }} />
          </View>
          <Text className="text-ink-2 text-[12.5px] font-medium">Create more</Text>
        </Pressable>

        <View className="flex-1">
          {added ? (
            <Text numberOfLines={1} className="text-success text-[12px] font-semibold">
              ✓ Added “{added}”
            </Text>
          ) : null}
        </View>

        {!compact && (
          <Pressable onPress={onClose} accessibilityRole="button" className="hover:bg-chip rounded-[9px] px-3 py-2">
            <Text className="text-ink-2 text-[13.5px] font-semibold">Cancel</Text>
          </Pressable>
        )}
        <Pressable
          onPress={submit}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          className={`flex-row items-center gap-2 rounded-[9px] px-3.5 py-2 ${canAdd ? "bg-accent hover:opacity-90" : "bg-chip"}`}
        >
          <Text className={`text-[13.5px] font-bold ${canAdd ? "text-on-accent" : "text-ink-3"}`}>Add task</Text>
          {!compact && <CornerDownLeft size={13} color={canAdd ? c.onAccent : c.ink3} strokeWidth={2.2} />}
        </Pressable>
      </View>
    </View>
  );
}
