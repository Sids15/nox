import {
  findFreeSlot,
  parseQuickAdd,
  usePrefs,
  tasksOnDay,
  timeToMinutes,
  useCreateTask,
  useSkippedOccurrences,
  useTasks,
  useThemeColors,
  type QuickAddResult,
} from "@nox/features";
import type { TaskInput } from "@nox/types";
import { formatTime12, todayKey } from "@nox/utils";
import { AiRepository } from "@nox/api";
import { ArrowUp, AudioLines, CornerDownLeft, Sparkles, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View, type TextStyle } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { DayPreview } from "./day-preview";
import { anchorOf, PropertyBar, rebaseReminders, type RepeatValue, type TaskProps } from "./task-properties";
import { withAlpha } from "../../lib/color";
import { useDictation } from "../../lib/dictation";
import { useAiCall, useAiEnabled } from "../../lib/use-ai";
import { AiButton } from "../ai/ai-ui";

const WEB = Platform.OS === "web";

/** The same font everywhere the title is drawn, so the web highlight layer lines up glyph for glyph. */
const TITLE_FONT: TextStyle = {
  // The serif, like every other title in the app (task, note and idea editors, page headings).
  fontFamily: Platform.select({
    // The user's heading typeface (see lib/heading-font.ts), like every other title.
    web: 'var(--nox-display, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    ios: "Georgia",
    default: "serif",
  }),
  fontSize: 21,
  lineHeight: 28,
  fontWeight: "700",
  letterSpacing: -0.1,
};


/** Press feedback (Emil Kowalski): a 0.97 squeeze so the button visibly hears the tap. */
const press = ({ pressed }: { pressed: boolean }) => ({
  transform: [{ scale: pressed ? 0.97 : 1 }],
  ...(Platform.OS === "web" ? ({ transitionProperty: "transform", transitionDuration: "140ms" } as object) : null),
});

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
  initialTime = null,
  initialTitle = "",
  spaceId = null,
  onClose,
  compact,
}: {
  /** Day the task starts on — the day focused in the Tasks week strip (null: no day). */
  initialDate: string | null;
  /** Words already typed (a space's Add box), so nothing is lost when opening the full composer. */
  initialTitle?: string;
  /** The space the task goes into (added from a space). */
  spaceId?: string | null;
  /** Time to start with (a calendar slot that was clicked). */
  initialTime?: string | null;
  onClose: () => void;
  /** Phone layout: stacked panels, send button. */
  compact: boolean;
}) {
  const c = useThemeColors();
  const createTask = useCreateTask();
  const today = todayKey();

  const [raw, setRaw] = useState(initialTitle);
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
  const [manDuration, setManDuration] = useState<number | null | undefined>(undefined);
  const askWhenAdding = usePrefs((s) => s.calendar.askWhenAdding);
  const calHours = usePrefs((s) => s.calendar);
  const [asked, setAsked] = useState(false);

  const titleRef = useRef<TextInput>(null);

  // Nox AI: turn a whole sentence ("dentist thursday afternoon, half an hour, urgent") into the fields.
  const aiOn = useAiEnabled();
  const ai = useAiCall(AiRepository.parseTask);
  /** What the composer looked like before AI filled it in, so Undo can put it back. */
  const [aiUndo, setAiUndo] = useState<null | {
    raw: string;
    description: string;
    parsing: boolean;
    manDate: string | null | undefined;
    manTime: string | null | undefined;
    manPriority: TaskProps["priority"] | undefined;
    manRepeat: RepeatValue | undefined;
    manDuration: number | null | undefined;
  }>(null);
  const dictation = useDictation((t) => setRaw((r) => (r.trim() ? `${r.trimEnd()} ${t.trim()}` : t.trim())));

  const parsed: QuickAddResult = useMemo(
    () => (parsing ? parseQuickAdd(raw, today) : { title: raw.trim(), matched: [] }),
    [raw, parsing, today],
  );

  // Effective values: by hand > recognised from the title > default.
  const repeat: RepeatValue =
    manRepeat ?? (parsed.repeat ? { kind: parsed.repeat.kind, weekdays: parsed.repeat.weekdays ?? [] } : { kind: "none", weekdays: [] });
  let date: string | null = manDate !== undefined ? manDate : (parsed.date ?? initialDate);
  if (repeat.kind !== "none" && date === null) date = today;
  const time = date === null ? null : manTime !== undefined ? manTime : (parsed.time ?? initialTime);
  const priority = manPriority ?? parsed.priority ?? "medium";
  const duration: number | null = manDuration !== undefined ? manDuration : (parsed.duration ?? null);
  const props: TaskProps = { date, time, reminders, repeat, priority, duration };

  // Which buttons show a value that came from the text (and wasn't overridden by hand).
  const autoFields = useMemo(() => {
    const set = new Set<string>();
    if (parsed.date !== undefined && manDate === undefined) set.add("date");
    if (parsed.time !== undefined && manTime === undefined) set.add("time");
    if (parsed.priority !== undefined && manPriority === undefined) set.add("priority");
    if (parsed.repeat !== undefined && manRepeat === undefined) set.add("repeat");
    if (parsed.duration !== undefined && manDuration === undefined) set.add("duration");
    return set;
  }, [parsed, manDate, manTime, manPriority, manRepeat, manDuration]);

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

  const fillWithAi = async () => {
    const sentence = raw.trim();
    if (!sentence || ai.busy) return;
    const draft = await ai.run(sentence, today);
    if (!draft) return;
    setAiUndo({ raw, description, parsing, manDate, manTime, manPriority, manRepeat, manDuration });
    setParsing(false); // the AI's title is final — don't re-read dates out of it
    setRaw(draft.title);
    if (draft.date) setManDate(draft.date);
    if (draft.time) setManTime(draft.time);
    if (draft.priority) setManPriority(draft.priority);
    if (draft.repeat && draft.repeat !== "none") setManRepeat({ kind: draft.repeat, weekdays: [] });
    if (draft.duration_minutes) setManDuration(draft.duration_minutes);
    if (draft.notes && !description.trim()) setDescription(draft.notes);
  };

  const undoAi = () => {
    if (!aiUndo) return;
    setRaw(aiUndo.raw);
    setDescription(aiUndo.description);
    setParsing(aiUndo.parsing);
    setManDate(aiUndo.manDate);
    setManTime(aiUndo.manTime);
    setManPriority(aiUndo.manPriority);
    setManRepeat(aiUndo.manRepeat);
    setManDuration(aiUndo.manDuration);
    setAiUndo(null);
  };

  const onChange = (patch: Partial<TaskProps>) => {
    setError(null);
    if ("date" in patch) setManDate(patch.date);
    if ("time" in patch) setManTime(patch.time);
    if (patch.priority) setManPriority(patch.priority);
    if (patch.repeat) setManRepeat(patch.repeat);
    if (patch.reminders) setReminders(patch.reminders);
    if ("duration" in patch) setManDuration(patch.duration ?? null);
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
    // Ask once for what the calendar needs (a time, then a length); Enter again adds it as it is.
    if (askWhenAdding && !asked && date !== null && (!time || !duration)) {
      setAsked(true);
      return;
    }
    const now = Date.now();
    const input: TaskInput = {
      title: title.slice(0, 200),
      notes: description.trim() ? description.trim().slice(0, 2000) : null,
      due_date: date,
      due_time: time,
      ...(time && duration ? { duration_minutes: duration } : {}),
      // A reminder already in the past would never fire.
      reminder_times: reminders.filter((iso) => new Date(iso).getTime() > now).sort(),
      priority,
      repeat: repeat.kind,
      repeat_config: repeat.kind === "custom" ? { weekdays: repeat.weekdays } : null,
      ...(spaceId ? { space_id: spaceId } : {}),
    };
    createTask.create(input);

    if (!createMore) {
      onClose();
      return;
    }
    // Create more: keep the settings, clear the words, go again.
    setAsked(false);
    setAiUndo(null);
    ai.reset();
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
  const FIELD_NAMES: Record<string, string> = { date: "date", time: "time", priority: "priority", repeat: "repeat", duration: "length" };
  const picked = [...new Set(parsed.matched.map((m) => FIELD_NAMES[m.field]!))];
  const wordCount = raw.trim().split(/\s+/).filter(Boolean).length;
  const offerAi = aiOn && !aiUndo && wordCount >= 3;
  const hint =
    raw.trim().length === 0 ? null : aiUndo ? (
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Sparkles size={11} color={c.accent} strokeWidth={2.2} />
        <Text className="text-ink-3 text-[12px]">Filled in by Nox AI — check it before adding ·</Text>
        <Pressable onPress={undoAi} hitSlop={6} accessibilityRole="button">
          <Text className="text-ink-2 text-[12px] font-semibold underline">Undo</Text>
        </Pressable>
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

  // A task already within half an hour of the chosen time, to mention once, quietly.
  const { data: allTasks = [] } = useTasks();
  const { data: skipped } = useSkippedOccurrences();
  const clash = useMemo(() => {
    if (!date || !time) return null;
    const at = timeToMinutes(time);
    return (
      tasksOnDay(allTasks, date, today, skipped).find(
        (p) => p.task.status !== "complete" && p.task.due_time && Math.abs(timeToMinutes(p.task.due_time) - at) < 30,
      ) ?? null
    );
  }, [allTasks, date, time, today, skipped]);

  const suggested = useMemo(() => {
    if (!date) return null;
    const d = new Date();
    const notBefore = date === today ? d.getHours() * 60 + d.getMinutes() + 10 : 0;
    return findFreeSlot(tasksOnDay(allTasks, date, today, skipped), duration ?? 30, {
      dayStart: calHours.startHour * 60,
      dayEnd: calHours.endHour * 60,
      notBefore,
    });
  }, [allTasks, date, today, skipped, duration, calHours.startHour, calHours.endHour]);

  // The day beside the box only when it has something to show: a time picked, or timed tasks that day.
  const dayHasTimed = useMemo(
    () => !!date && tasksOnDay(allTasks, date, today, skipped).some((p) => p.task.status !== "complete" && p.task.due_time),
    [allTasks, date, today, skipped],
  );
  const showDay = !compact && !!date && (!!time || dayHasTimed);

  const form = (
    <View>
      <View className={`pb-1 pl-5 ${compact ? "pr-5 pt-4" : "pr-12 pt-5"}`}>
        {/* No label above the title — the placeholder already says what this is. */}
        {!compact && (
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="hover:bg-chip absolute right-3 top-3.5 z-10 h-8 w-8 items-center justify-center rounded-full"
          >
            <X size={15} color={c.ink3} strokeWidth={2} />
          </Pressable>
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
        {offerAi || ai.error ? (
          <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
            {offerAi && <AiButton label="Fill in with AI" onPress={fillWithAi} busy={ai.busy} />}
            {ai.error ? <Text className="text-high flex-1 text-[12px]">{ai.error}</Text> : null}
          </View>
        ) : null}
        {dictation.listening ? (
          <Text numberOfLines={2} className="text-ink-3 mt-2 text-[13px]">
            {dictation.interim || "Listening… say the task, the day and how long it takes"}
          </Text>
        ) : null}
        {dictation.error ? <Text className="text-high mt-2 text-[12px]">{dictation.error}</Text> : null}
        {clash ? (
          <View className="mt-2 flex-row items-center gap-1.5">
            <View className="bg-medium h-1.5 w-1.5 rounded-full" />
            <Text numberOfLines={1} className="text-ink-3 flex-1 text-[13px]">
              Also at {formatTime12(clash.task.due_time)}: <Text className="text-ink-2 font-medium">{clash.task.title}</Text>
            </Text>
          </View>
        ) : null}
        {asked && date !== null && (!time || !duration) ? (
          <View className="bg-accent/[0.06] mt-3 gap-2.5 rounded-[12px] px-3 py-3" accessibilityLiveRegion="polite">
            {!time && (
              <View>
                <Text className="text-ink text-[14px] font-semibold">When will you do it?</Text>
                <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                  {suggested ? (
                    <Pressable onPress={() => onChange({ time: suggested })} accessibilityRole="button" style={press} className="bg-accent h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2.5">
                      <Sparkles size={12} color={c.onAccent} strokeWidth={2.4} />
                      <Text className="text-on-accent text-[13px] font-semibold">{formatTime12(suggested)}</Text>
                      <Text className="text-on-accent text-[12px] opacity-80">next free slot</Text>
                    </Pressable>
                  ) : (
                    <Text className="text-ink-3 text-[13px]">No free slot left in your hours that day.</Text>
                  )}
                  <Text className="text-ink-3 text-[13px]">or set Time below, or press Enter to keep it anytime</Text>
                </View>
              </View>
            )}
            {time && !duration && (
              <View>
                <Text className="text-ink text-[14px] font-semibold">How long will it take?</Text>
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  {[15, 30, 45, 60, 90, 120].map((m) => (
                    <Pressable key={m} onPress={() => onChange({ duration: m })} accessibilityRole="button" style={press} className="border-line hover:bg-chip h-[30px] justify-center rounded-[8px] border px-2.5">
                      <Text style={{ fontVariant: ["tabular-nums"] }} className="text-ink text-[13px] font-medium">
                        {m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60}` : `${m / 60} hr`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : null}
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

      {error ? <Text className="text-high mt-3 px-5 text-[13px]">{error}</Text> : null}
    </View>
  );

  return (
    <View>
      {!showDay ? (
        form
      ) : (
        // The form sets the height; the day beside it fills that and scrolls inside.
        <View className="flex-row" style={{ minHeight: 200 }}>
          <View className="min-w-0 flex-1 pb-4">{form}</View>
          <View className="bg-bg w-[230px]" style={{ borderLeftWidth: 1, borderLeftColor: withAlpha(c.ink3, 0.1) }}>
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              <DayPreview date={date} time={time} title={title} today={today} duration={duration} onPickTime={(t) => onChange({ time: t })} />
            </View>
          </View>
        </View>
      )}

      {/* Footer band */}
      <View className="mt-2 flex-row items-center gap-3 px-4 pb-3.5 pt-2">
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
          <Text className="text-ink-2 text-[13px] font-medium">Create more</Text>
        </Pressable>

        {dictation.supported && (
          <Pressable
            onPress={dictation.listening ? dictation.stop : dictation.start}
            accessibilityRole="button"
            accessibilityLabel={dictation.listening ? "Stop dictating" : "Dictate the task"}
            accessibilityState={{ selected: dictation.listening }}
            style={press}
            className={`h-8 flex-row items-center gap-1.5 rounded-[8px] px-2 ${dictation.listening ? "bg-accent" : "hover:bg-chip"}`}
          >
            <AudioLines size={15} color={dictation.listening ? c.onAccent : c.ink2} strokeWidth={2} />
            {!compact && (
              <Text className={`text-[13px] font-medium ${dictation.listening ? "text-on-accent" : "text-ink-2"}`}>
                {dictation.listening ? "Stop" : "Dictate"}
              </Text>
            )}
          </Pressable>
        )}

        <View className="flex-1">
          {added ? (
            <Text numberOfLines={1} className="text-success text-[12px] font-semibold">
              Added “{added}”
            </Text>
          ) : null}
        </View>

        {compact ? (
          <Pressable
            onPress={submit}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel="Add task"
            style={press}
            className={`h-10 w-10 items-center justify-center rounded-full ${canAdd ? "bg-accent" : "bg-chip"}`}
          >
            <ArrowUp size={18} color={canAdd ? c.onAccent : c.ink3} strokeWidth={2.6} />
          </Pressable>
        ) : (
          <>

            <Pressable
              onPress={submit}
              disabled={!canAdd}
              accessibilityRole="button"
              accessibilityLabel="Add task"
              style={press}
              className={`h-[34px] flex-row items-center gap-2 rounded-[9px] px-3.5 ${canAdd ? "bg-accent hover:opacity-90" : "bg-chip"}`}
            >
              <Text className={`text-[13px] font-bold ${canAdd ? "text-on-accent" : "text-ink-3"}`}>Add task</Text>
              <CornerDownLeft size={13} color={canAdd ? c.onAccent : c.ink3} strokeWidth={2.4} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
