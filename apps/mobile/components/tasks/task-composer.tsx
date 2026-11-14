import { parseQuickAdd, useCreateTask, useThemeColors, type QuickAddResult } from "@nox/features";
import type { TaskInput } from "@nox/types";
import { todayKey } from "@nox/utils";
import { ArrowUp, Sparkles, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View, type TextStyle } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { anchorOf, PropertyBar, rebaseReminders, type RepeatValue, type TaskProps } from "./task-properties";

const WEB = Platform.OS === "web";

/** The same font everywhere the title is drawn, so the web highlight layer lines up glyph for glyph. */
const TITLE_FONT: TextStyle = {
  fontFamily: 'System, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: 19,
  lineHeight: 26,
  fontWeight: "600",
  letterSpacing: -0.19,
};

const TIPS = "Try “tomorrow 6pm”, “every mon”, “!high”";

/**
 * The task-name field, with the phrases quick add recognised highlighted in place — Todoist's smart
 * quick add — instead of repeating them in a row of chips underneath.
 *
 * Web draws it as two layers: the styled text underneath, and a transparent textarea on top that
 * takes the typing and shows the caret. Native has no reliable way to line two layers up, so it gets
 * the plain field; the sparkle on each property button says what was picked up.
 */
function TitleField({
  value,
  onChange,
  parsed,
  onSubmit,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  parsed: QuickAddResult;
  onSubmit: () => void;
  inputRef: React.RefObject<TextInput | null>;
}) {
  const c = useThemeColors();
  const clean = (v: string) => onChange(v.replace(/[\r\n]+/g, " "));

  if (!WEB) {
    return (
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={clean}
        onSubmitEditing={onSubmit}
        submitBehavior="submit"
        multiline
        returnKeyType="done"
        maxLength={240}
        placeholder="What needs doing?"
        placeholderTextColor={c.ink3}
        accessibilityLabel="Task name"
        style={[TITLE_FONT, { color: c.ink, paddingVertical: 0, minHeight: 26 }]}
      />
    );
  }

  // Split the text into plain runs and recognised phrases.
  const runs: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const m of parsed.matched) {
    if (m.start > at) runs.push({ text: value.slice(at, m.start), hit: false });
    runs.push({ text: value.slice(m.start, m.end), hit: true });
    at = m.end;
  }
  if (at < value.length) runs.push({ text: value.slice(at), hit: false });

  return (
    <View style={{ position: "relative" }}>
      {/* What you see. The trailing zero-width space keeps a trailing space / empty line measured. */}
      <Text style={[TITLE_FONT, { color: c.ink }]} accessibilityElementsHidden importantForAccessibility="no">
        {value.length === 0 ? (
          <Text style={{ color: c.ink3 }}>What needs doing?</Text>
        ) : (
          runs.map((r, i) =>
            r.hit ? (
              <Text key={i} style={{ color: c.accent, backgroundColor: `${c.accent}26`, borderRadius: 4 }}>
                {r.text}
              </Text>
            ) : (
              <Text key={i}>{r.text}</Text>
            ),
          )
        )}
        {"​"}
      </Text>
      {/* What you type into: same metrics, invisible text, visible caret. */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={clean}
        multiline
        maxLength={240}
        accessibilityLabel="Task name"
        onKeyPress={(e) => {
          const ne = e.nativeEvent as unknown as { key: string; shiftKey?: boolean; isComposing?: boolean };
          if (ne.key === "Enter" && !ne.shiftKey && !ne.isComposing) {
            (e as unknown as { preventDefault: () => void }).preventDefault();
            onSubmit();
          }
        }}
        style={[
          TITLE_FONT,
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            color: "transparent",
            padding: 0,
            overflow: "hidden",
            outlineWidth: 0,
          },
          { caretColor: c.accent } as TextStyle,
        ]}
      />
    </View>
  );
}

/**
 * Quick-add composer for a new task, used inside NewTaskDialog (a centred dialog on desktop, a bottom
 * sheet on phones). Modelled on the quick-add flows of Todoist, Linear and Things:
 *
 * - The name leads; type naturally — "Call mum tomorrow 6pm !high" — and the recognised phrases light
 *   up in place, fill the matching property buttons (marked with a sparkle) and are stripped from the
 *   saved name. "Keep as text" turns recognition off for this task.
 * - Properties live in the shared PropertyBar (the same one the task editor uses); a value picked by
 *   hand always beats one read from the text.
 * - Nothing is written until Add. "Create more" keeps the composer open with the same settings.
 */
export function TaskComposer({
  initialDate,
  onClose,
  compact,
}: {
  /** Day the task starts on — the day focused in the Tasks week strip. */
  initialDate: string;
  onClose: () => void;
  /** Phone layout: stacked panels, send button. */
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

  const parsed: QuickAddResult = useMemo(
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

  // Which buttons show a value that came from the text (and wasn't overridden by hand).
  const autoFields = useMemo(() => {
    const set = new Set<string>();
    if (parsed.date !== undefined && manDate === undefined) set.add("date");
    if (parsed.time !== undefined && manTime === undefined) set.add("time");
    if (parsed.priority !== undefined && manPriority === undefined) set.add("priority");
    if (parsed.repeat !== undefined && manRepeat === undefined) set.add("repeat");
    return set;
  }, [parsed, manDate, manTime, manPriority, manRepeat]);

  // Reminders keep their distance from the task when its date/time moves — whether by hand or
  // because the typed name now says a different day.
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
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  // Esc closes and Cmd/Ctrl+Enter adds, from anywhere in the dialog. Capture phase: a focused text
  // field stops key events bubbling on web. (An open property panel takes Esc first — see PropertyBar.)
  useEffect(() => {
    if (!WEB) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  // One quiet line under the notes: how to type dates while the name is empty, then what was
  // picked up from it (with the way out), or the way back in once recognition is off.
  const FIELD_NAMES: Record<string, string> = { date: "date", time: "time", priority: "priority", repeat: "repeat" };
  const picked = [...new Set(parsed.matched.map((m) => FIELD_NAMES[m.field]!))];
  const hint =
    raw.trim().length === 0 ? (
      <View className="flex-row items-center gap-1.5">
        <Sparkles size={11} color={c.ink3} strokeWidth={2} />
        <Text className="text-ink-3 text-[12px]">{TIPS}</Text>
      </View>
    ) : picked.length > 0 ? (
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Sparkles size={11} color={c.accent} strokeWidth={2.2} />
        <Text className="text-ink-3 text-[12px]">
          {compact ? "From your text ·" : `Picked up the ${picked.join(", ").replace(/, ([^,]*)$/, " and $1")} from your text ·`}
        </Text>
        <Pressable onPress={() => setParsing(false)} hitSlop={6} accessibilityRole="button">
          <Text className="text-ink-2 text-[12px] font-semibold underline">Keep as text</Text>
        </Pressable>
      </View>
    ) : !parsing ? (
      <Pressable onPress={() => setParsing(true)} hitSlop={6} accessibilityRole="button" className="flex-row items-center gap-1.5 self-start">
        <Sparkles size={11} color={c.accent} strokeWidth={2.2} />
        <Text className="text-ink-3 text-[12px]">
          Dates in the name are kept as text · <Text className="text-accent font-semibold">Read them again</Text>
        </Text>
      </Pressable>
    ) : null;

  return (
    <View>
      <View className="px-5 pb-1 pt-5">
        {!compact && (
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-ink-3 font-mono text-[10px] font-semibold tracking-[0.16em]">NEW TASK</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="hover:bg-chip -mr-1.5 -mt-1 h-7 w-7 items-center justify-center rounded-full"
            >
              <X size={15} color={c.ink3} strokeWidth={2} />
            </Pressable>
          </View>
        )}

        <TitleField value={raw} onChange={setRaw} parsed={parsed} onSubmit={submit} inputRef={titleRef} />
        <AutoGrowInput
          value={description}
          onChangeText={setDescription}
          placeholder="Notes"
          placeholderTextColor={c.ink3}
          maxLength={2000}
          minHeight={22}
          accessibilityLabel="Notes"
          className="text-ink-2 mt-1.5 text-[14px] leading-[21px]"
          style={{ textAlignVertical: "top" }}
        />
        {hint ? <View className="mt-2.5">{hint}</View> : null}
      </View>

      <View className="mt-3">
        <PropertyBar
          value={props}
          onChange={onChange}
          today={today}
          compact={compact}
          autoFields={autoFields}
        />
      </View>

      {error ? <Text className="text-high mt-3 px-5 text-[12.5px]">{error}</Text> : null}

      {/* Footer band */}
      <View className="border-line bg-surface/60 mt-4 flex-row items-center gap-3 border-t px-4 py-3">
        <Pressable
          onPress={() => setCreateMore((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: createMore }}
          accessibilityLabel="Create more"
          className="flex-row items-center gap-2"
          hitSlop={6}
        >
          <View
            style={{
              width: 28,
              height: 16,
              borderRadius: 99,
              padding: 2,
              alignItems: createMore ? "flex-end" : "flex-start",
              backgroundColor: createMore ? c.accent : c.chip,
              borderWidth: createMore ? 0 : 1,
              borderColor: c.line,
            }}
          >
            <View style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: createMore ? "#fff" : c.ink3 }} />
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

        {compact ? (
          <Pressable
            onPress={submit}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel="Add task"
            className={`h-9 w-9 items-center justify-center rounded-full ${canAdd ? "bg-accent" : "bg-chip"}`}
          >
            <ArrowUp size={18} color={canAdd ? c.onAccent : c.ink3} strokeWidth={2.6} />
          </Pressable>
        ) : (
          <>
            <Pressable onPress={onClose} accessibilityRole="button" className="hover:bg-chip rounded-[9px] px-3 py-2">
              <Text className="text-ink-2 text-[13px] font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!canAdd}
              accessibilityRole="button"
              accessibilityLabel="Add task"
              className={`flex-row items-center gap-2 rounded-[9px] px-3.5 py-2 ${canAdd ? "bg-accent hover:opacity-90" : "bg-chip"}`}
            >
              <Text className={`text-[13px] font-bold ${canAdd ? "text-on-accent" : "text-ink-3"}`}>Add task</Text>
              <View className={`rounded-[4px] px-1 ${canAdd ? "bg-white/20" : "bg-line"}`}>
                <Text className={`font-mono text-[10px] font-bold ${canAdd ? "text-on-accent" : "text-ink-3"}`}>↵</Text>
              </View>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
