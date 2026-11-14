import { parseQuickAdd, useCreateTask, useThemeColors } from "@nox/features";
import type { TaskInput } from "@nox/types";
import { todayKey } from "@nox/utils";
import { CornerDownLeft, Sparkles, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { anchorOf, PropertyBar, rebaseReminders, type RepeatValue, type TaskProps } from "./task-properties";

/**
 * Quick-add composer for a new task, used inside NewTaskDialog (a centred dialog on desktop, a bottom
 * sheet on phones). Modelled on the quick-add flows of Todoist, Linear and Things:
 *
 * - The title leads; type naturally — "Call mum tomorrow 6pm !high" — and the date, time, priority and
 *   repeat are recognised (parseQuickAdd), previewed under the title, and stripped from the saved
 *   title. "Keep as text" turns recognition off for this task.
 * - Everything else lives in the shared PropertyBar (the same one the task editor uses). A value
 *   picked by hand always beats one recognised from the text.
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
  const createTask = useCreateTask();
  const today = todayKey();

  const [raw, setRaw] = useState("");
  const [description, setDescription] = useState("");
  const [parsing, setParsing] = useState(true);
  const [createMore, setCreateMore] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Values picked by hand. `undefined` = untouched, so the recognised/default value applies.
  const [manDate, setManDate] = useState<string | null | undefined>(undefined);
  const [manTime, setManTime] = useState<string | null | undefined>(undefined);
  const [manPriority, setManPriority] = useState<TaskProps["priority"] | undefined>(undefined);
  const [manRepeat, setManRepeat] = useState<RepeatValue | undefined>(undefined);
  const [reminders, setReminders] = useState<string[]>([]);

  const titleRef = useRef<TextInput>(null);

  const parsed = useMemo(
    () => (parsing ? parseQuickAdd(raw, today) : { title: raw.trim(), matched: [] }),
    [raw, parsing, today],
  );

  // Effective values: by hand > recognised from the title > default.
  const repeat: RepeatValue =
    manRepeat ?? (parsed.repeat ? { kind: parsed.repeat.kind, weekdays: parsed.repeat.weekdays ?? [] } : { kind: "none", weekdays: [] });
  let date: string | null = manDate !== undefined ? manDate : (parsed.date ?? initialDate);
  if (repeat.kind !== "none" && date === null) date = today;
  const time = date === null ? null : manTime !== undefined ? manTime : (parsed.time ?? null);
  const priority = manPriority ?? parsed.priority ?? "medium";
  const props: TaskProps = { date, time, reminders, repeat, priority };

  // Reminders keep their distance from the task when its date/time moves — whether by hand or
  // because the typed title now says a different day.
  const anchorRef = useRef(anchorOf(date, time));
  useEffect(() => {
    const next = anchorOf(date, time);
    setReminders((r) => rebaseReminders(r, anchorRef.current, next));
    anchorRef.current = next;
  }, [date, time]);

  const title = parsed.title;
  const canAdd = title.length > 0;

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 3500);
    return () => clearTimeout(t);
  }, [added]);

  const onChange = (patch: Partial<TaskProps>) => {
    setError(null);
    if ("date" in patch) setManDate(patch.date);
    if ("time" in patch) setManTime(patch.time);
    if (patch.priority) setManPriority(patch.priority);
    if (patch.repeat) setManRepeat(patch.repeat);
    if (patch.reminders) setReminders(patch.reminders);
  };

  const submit = () => {
    if (!canAdd) {
      titleRef.current?.focus();
      return;
    }
    if (repeat.kind === "custom" && repeat.weekdays.length === 0) {
      setError("Pick at least one day for the repeat, or set it to Never.");
      return;
    }
    const now = Date.now();
    const input: TaskInput = {
      title: title.slice(0, 200),
      notes: description.trim() ? description.trim().slice(0, 2000) : null,
      due_date: date,
      due_time: time,
      // A reminder already in the past would never fire.
      reminder_times: reminders.filter((iso) => new Date(iso).getTime() > now).sort(),
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
    // After the re-render: on web, submitting blurs the field before the clear lands.
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  // Cmd/Ctrl+Enter adds from anywhere; Esc closes — the property bar swallows an Esc that only
  // needs to fold its open panel.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

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

      <View className="mt-4">
        <PropertyBar value={props} onChange={onChange} today={today} compact={compact} />
      </View>

      {error ? <Text className="text-high mt-3 px-5 text-[12.5px]">{error}</Text> : null}

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
