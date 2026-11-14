import { useCreateTask, usePrefs, useThemeColors } from "@nox/features";
import { taskPriorityLevels, type Task, type TaskInput } from "@nox/types";
import {
  addDays,
  capitalize as cap,
  dayOfMonth,
  dayOfWeek,
  formatTime12,
  monthShort,
  relativeDayLabel,
  toDateKey,
  todayKey,
  weekdayShort,
} from "@nox/utils";
import { Bell, Calendar, Clock, Repeat, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { NoxDateTimePicker } from "../date-time-picker";
import { useIsDesktop } from "../../lib/use-responsive";
import { SegmentedControl } from "./segmented-control";

const TIME_PRESETS = ["09:00", "12:00", "15:00", "18:00", "21:00"];

const REPEAT_OPTS: { value: Task["repeat"]; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "weekdays", label: "Weekdays" },
  { value: "custom", label: "Custom" },
];
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Reminder choices, relative to the due date/time so they stay meaningful whatever day is picked.
 * With a time: at it, or before it. Without one: a sensible clock time on the day, or the evening
 * before. Stored on the task as absolute timestamps, computed at save time.
 */
type ReminderKey = "at" | "10m" | "1h" | "1d" | "morning" | "eve";
const TIMED_REMINDERS: { key: ReminderKey; label: string }[] = [
  { key: "at", label: "At time" },
  { key: "10m", label: "10 min before" },
  { key: "1h", label: "1 hour before" },
  { key: "1d", label: "1 day before" },
];
const ALLDAY_REMINDERS: { key: ReminderKey; label: string }[] = [
  { key: "morning", label: "9 AM that day" },
  { key: "eve", label: "6 PM the day before" },
];

function localDate(dateKey: string, time: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const [h, min] = time.split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function reminderAt(key: ReminderKey, dateKey: string, time: string | null): Date {
  switch (key) {
    case "at":
      return localDate(dateKey, time ?? "09:00");
    case "10m":
      return new Date(localDate(dateKey, time ?? "09:00").getTime() - 10 * 60_000);
    case "1h":
      return new Date(localDate(dateKey, time ?? "09:00").getTime() - 60 * 60_000);
    case "1d":
      return localDate(addDays(dateKey, -1), time ?? "09:00");
    case "morning":
      return localDate(dateKey, "09:00");
    case "eve":
      return localDate(addDays(dateKey, -1), "18:00");
  }
}

/** Next Monday after `today` (a full week out when today is Monday). */
function nextMonday(today: string): string {
  const dow = dayOfWeek(today);
  return addDays(today, ((8 - dow) % 7) || 7);
}

function dateLabel(key: string, today: string): string {
  const rel = relativeDayLabel(key, today);
  if (rel === "today" || rel === "tomorrow") return cap(rel);
  return `${cap(weekdayShort(key).toLowerCase())} ${cap(monthShort(key).toLowerCase())} ${dayOfMonth(key)}`;
}

function Chip({
  label,
  active,
  onPress,
  dashed,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  dashed?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-pill flex-row items-center gap-1.5 px-3.5 py-[8px] ${
        active
          ? "bg-accent"
          : dashed
            ? "border-accent/[0.5] border border-dashed"
            : "bg-chip hover:bg-elev"
      }`}
    >
      {icon}
      <Text className={`text-[13px] font-semibold ${active ? "text-on-accent" : dashed ? "text-accent" : "text-ink-2"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A labelled row inside a card: icon + label above a wrapping row of chips. */
function Row({ icon, label, last, children }: { icon: ReactNode; label: string; last?: boolean; children: ReactNode }) {
  return (
    <View className={`px-[14px] py-3 ${last ? "" : "border-line border-b"}`}>
      <View className="mb-2.5 flex-row items-center gap-2">
        {icon}
        <Text className="text-ink-2 text-[13px] font-semibold">{label}</Text>
      </View>
      <View className="flex-row flex-wrap gap-1.5">{children}</View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-3 mb-2 mt-6 pl-0.5 font-mono text-[10px] font-semibold tracking-[0.14em]">{children}</Text>
  );
}

/**
 * The new-task composer. Nothing is written until Add: the old flow inserted a task titled "New task"
 * the moment you tapped +, then opened the full editor on it — so backing out left a stray "New task"
 * in the list, and you had to clear the placeholder title before typing your own.
 *
 * Title first and focused; every scheduling choice is one tap (quick dates, common times, reminders
 * relative to the due time) with an exact picker behind "Pick…". Enter in the title adds the task.
 * Used as the /task/new screen on phones and as the right-hand pane on desktop.
 */
export function TaskComposer({
  initialDate,
  onDone,
}: {
  /** Date the task starts on (the day focused in the week strip). */
  initialDate: string;
  /** Called after Add or Cancel; `createdId` is set when a task was added. */
  onDone: (createdId?: string) => void;
}) {
  const c = useThemeColors();
  const theme = usePrefs((s) => s.theme);
  const isDesktop = useIsDesktop();
  const createTask = useCreateTask();
  const today = todayKey();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<string | null>(initialDate);
  const [time, setTime] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderKey[]>([]);
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [repeat, setRepeat] = useState<Task["repeat"]>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [picker, setPicker] = useState<{ mode: "date" | "time"; value: Date } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<TextInput>(null);

  // Focus after mount: autoFocus fires before a pushed screen finishes its transition on native,
  // which can drop the keyboard; a tick later is reliable on every platform.
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  // Escape cancels on desktop/web, like any dialog.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDone]);

  const quickDates = useMemo(() => {
    const opts = [
      { key: today, label: "Today" },
      { key: addDays(today, 1), label: "Tomorrow" },
      { key: nextMonday(today), label: "Next week" },
    ];
    // Keep a day picked elsewhere (the week strip, or "Pick…") visible as its own chip.
    if (date && !opts.some((o) => o.key === date)) opts.push({ key: date, label: dateLabel(date, today) });
    return opts;
  }, [today, date]);

  const reminderOpts = time ? TIMED_REMINDERS : ALLDAY_REMINDERS;
  const canSave = title.trim().length > 0;

  const chooseDate = (next: string | null) => {
    setDate(next);
    if (next === null) {
      // No day means no time, no reminders and no repeat — each needs a day to hang off.
      setTime(null);
      setReminders([]);
      setRepeat("none");
    }
  };

  const chooseTime = (next: string | null) => {
    // Reminder choices differ between timed and all-day tasks; don't carry the other kind over.
    if ((next === null) !== (time === null)) setReminders([]);
    setTime(next);
  };

  const chooseRepeat = (next: Task["repeat"]) => {
    const anchor = date ?? today;
    if (!date) setDate(anchor);
    setRepeat(next);
    if (next === "custom" && weekdays.length === 0) setWeekdays([dayOfWeek(anchor)]);
  };

  const toggleReminder = (key: ReminderKey) =>
    setReminders((r) => (r.includes(key) ? r.filter((k) => k !== key) : [...r, key]));

  const toggleWeekday = (dow: number) =>
    setWeekdays((w) => (w.includes(dow) ? w.filter((d) => d !== dow) : [...w, dow].sort((a, b) => a - b)));

  const confirmPicker = () => {
    if (!picker) return;
    if (picker.mode === "date") chooseDate(toDateKey(picker.value));
    else {
      const h = String(picker.value.getHours()).padStart(2, "0");
      const m = String(picker.value.getMinutes()).padStart(2, "0");
      chooseTime(`${h}:${m}`);
    }
    setPicker(null);
  };

  const save = () => {
    const name = title.trim();
    if (!name) {
      titleRef.current?.focus();
      return;
    }
    if (repeat === "custom" && weekdays.length === 0) {
      setError("Pick at least one day for the repeat, or set Repeat to Never.");
      return;
    }
    const now = Date.now();
    const reminderTimes = date
      ? reminders
          .map((k) => reminderAt(k, date, time))
          .filter((d) => d.getTime() > now) // a reminder already in the past would never fire
          .sort((a, b) => a.getTime() - b.getTime())
          .map((d) => d.toISOString())
      : [];
    const input: TaskInput = {
      title: name.slice(0, 200),
      notes: notes.trim() ? notes.trim().slice(0, 2000) : null,
      due_date: date,
      due_time: time,
      reminder_times: reminderTimes,
      priority,
      repeat,
      repeat_config: repeat === "custom" ? { weekdays } : null,
    };
    const id = createTask.create(input);
    onDone(id);
  };

  const priorityColor: Record<Task["priority"], string> = { low: c.ink3, medium: c.medium, high: c.high };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header: Cancel · New task · Add */}
      <View
        className="border-line flex-row items-center justify-between border-b px-4 py-3"
        style={isDesktop ? { paddingTop: 22 } : undefined}
      >
        <Pressable onPress={() => onDone()} hitSlop={8} accessibilityRole="button" className="min-w-[64px]">
          <Text className="text-ink-2 text-[15px]">Cancel</Text>
        </Pressable>
        <Text className="text-ink text-[16px] font-bold tracking-[-0.01em]">New task</Text>
        <View className="min-w-[64px] items-end">
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Add task"
            className={`rounded-pill px-4 py-[7px] ${canSave ? "bg-accent hover:opacity-90" : "bg-chip"}`}
          >
            <Text className={`text-[14px] font-bold ${canSave ? "text-on-accent" : "text-ink-3"}`}>Add</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Title + notes */}
        <View className="px-screen pt-6">
          <TextInput
            ref={titleRef}
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              if (error) setError(null);
            }}
            onSubmitEditing={save}
            submitBehavior="submit"
            returnKeyType="done"
            maxLength={200}
            placeholder="What needs doing?"
            placeholderTextColor={c.ink3}
            accessibilityLabel="Task title"
            className="text-ink text-[24px] font-bold tracking-[-0.02em]"
            style={{ paddingVertical: 0, minHeight: 32 }}
          />
          <AutoGrowInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes"
            placeholderTextColor={c.ink3}
            maxLength={2000}
            minHeight={24}
            accessibilityLabel="Notes"
            className="text-ink-2 mt-2 text-[15px] leading-[22px]"
            style={{ textAlignVertical: "top" }}
          />
        </View>

        <View className="px-screen">
          {/* When */}
          <SectionLabel>WHEN</SectionLabel>
          <View className="border-line bg-surface rounded-card overflow-hidden border">
            <Row icon={<Calendar size={15} color={c.ink3} strokeWidth={1.8} />} label="Date" last={!date}>
              {quickDates.map((d) => (
                <Chip key={d.key} label={d.label} active={date === d.key} onPress={() => chooseDate(d.key)} />
              ))}
              <Chip
                label="Pick…"
                active={false}
                dashed
                onPress={() => setPicker({ mode: "date", value: date ? localDate(date, "12:00") : new Date() })}
              />
              <Chip label="No date" active={date === null} onPress={() => chooseDate(null)} />
            </Row>

            {date && (
              <Row icon={<Clock size={15} color={c.ink3} strokeWidth={1.8} />} label="Time">
                <Chip label="All day" active={time === null} onPress={() => chooseTime(null)} />
                {TIME_PRESETS.map((t) => (
                  <Chip key={t} label={formatTime12(t)!} active={time === t} onPress={() => chooseTime(t)} />
                ))}
                {time && !TIME_PRESETS.includes(time) && (
                  <Chip label={formatTime12(time)!} active onPress={() => chooseTime(time)} />
                )}
                <Chip
                  label="Custom…"
                  active={false}
                  dashed
                  onPress={() => setPicker({ mode: "time", value: localDate(date, time ?? "09:00") })}
                />
              </Row>
            )}

            {date && (
              <Row icon={<Bell size={15} color={c.ink3} strokeWidth={1.8} />} label="Remind me" last>
                {reminderOpts.map((r) => (
                  <Chip key={r.key} label={r.label} active={reminders.includes(r.key)} onPress={() => toggleReminder(r.key)} />
                ))}
              </Row>
            )}
          </View>

          {/* Repeat */}
          <SectionLabel>REPEAT</SectionLabel>
          <View className="border-line bg-surface rounded-card overflow-hidden border">
            <View className="flex-row items-center gap-3 px-[14px] py-3">
              <Repeat size={15} color={c.ink3} strokeWidth={1.8} />
              <View className="flex-1">
                <SegmentedControl value={repeat} onChange={chooseRepeat} options={REPEAT_OPTS} />
              </View>
            </View>
            {repeat === "custom" && (
              <View className="border-line flex-row justify-between border-t px-[14px] py-3">
                {WEEKDAY_LETTERS.map((letter, dow) => {
                  const on = weekdays.includes(dow);
                  return (
                    <Pressable
                      key={dow}
                      onPress={() => toggleWeekday(dow)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      className={`h-9 w-9 items-center justify-center rounded-full ${on ? "bg-accent" : "bg-chip"}`}
                    >
                      <Text className={`text-[13px] font-semibold ${on ? "text-on-accent" : "text-ink-2"}`}>{letter}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Priority */}
          <SectionLabel>PRIORITY</SectionLabel>
          <SegmentedControl
            value={priority}
            onChange={setPriority}
            options={taskPriorityLevels.map((p) => ({ value: p, label: cap(p), color: priorityColor[p] }))}
          />

          {error ? <Text className="text-high mt-4 text-[13px]">{error}</Text> : null}

          {/* Big thumb-reach button on phones; desktop has the header Add and Enter. */}
          {!isDesktop && (
            <Pressable
              onPress={save}
              disabled={!canSave}
              className={`mt-7 items-center rounded-[14px] py-[14px] ${canSave ? "bg-accent" : "bg-chip"}`}
              style={canSave ? { shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 } : undefined}
            >
              <Text className={`text-[15px] font-bold ${canSave ? "text-on-accent" : "text-ink-3"}`}>Add task</Text>
            </Pressable>
          )}
          {isDesktop && (
            <Text className="text-ink-3 mt-6 text-center font-mono text-[10.5px]">enter to add · esc to cancel</Text>
          )}
        </View>
      </ScrollView>

      {/* Exact date / time picker */}
      {picker && (
        <>
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setPicker(null)} />
          <View className="border-line bg-sheet absolute inset-x-0 bottom-0 border-t pb-8 pt-1">
            <View className="px-screen flex-row items-center justify-between py-2">
              <Pressable onPress={() => setPicker(null)} hitSlop={8}>
                <X size={18} color={c.ink2} strokeWidth={2} />
              </Pressable>
              <Text className="text-ink text-[15px] font-semibold">{picker.mode === "date" ? "Pick a date" : "Pick a time"}</Text>
              <Pressable onPress={confirmPicker} hitSlop={8}>
                <Text className="text-accent text-[15px] font-semibold">Done</Text>
              </Pressable>
            </View>
            <NoxDateTimePicker
              value={picker.value}
              mode={picker.mode}
              theme={theme}
              textColor={c.ink}
              onChange={(d) => setPicker((p) => (p ? { ...p, value: d } : p))}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
