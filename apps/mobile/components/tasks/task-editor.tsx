import { AiRepository } from "@nox/api";
import { findFreeSlot, tasksOnDay, useCreateTask, usePrefs, useSkippedOccurrences, useTasks, useThemeColors, useToggleTask, useUpdateTask } from "@nox/features";
import type { TaskInput } from "@nox/types";
import { formatTime12, relativeDayLabel, relativeFromNow, shortDate, todayKey } from "@nox/utils";
import { Check, ChevronLeft, CircleCheck, CircleDashed, MoreHorizontal, Repeat, RotateCcw, Sparkles, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIsDesktop } from "../../lib/use-responsive";
import { isRepeating, useTaskDelete } from "../../lib/use-task-delete";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { MenuDivider, MenuRow, pressScale, TABULAR } from "../menu";
import { Popover } from "../popover";
import { anchorOf, durationLabel, PropertyBar, rebaseReminders, type TaskProps } from "./task-properties";
import { useAiCall, useAiEnabled } from "../../lib/use-ai";
import { AiAction, AiButton, AiPanel } from "../ai/ai-ui";

/** Left edge of the title text: checkbox (24) + gap (12). Notes, status and properties align to it. */
const TEXT_INDENT = 36;

/**
 * The task editor, built like the new-task dialog it pairs with: the task on the page rather than in
 * a card — priority-ringed checkbox and title, notes beneath, then the shared property bar (Date ·
 * Time · Remind · Repeat · Priority) whose options open as anchored menus. Everything saves as you
 * change it; title and notes save when you leave the field.
 *
 * Driven by an `id` so it works as the /task/[id] screen and as the desktop side pane; `onClose` is
 * what Back and delete call. Renders no SafeAreaView / Sidebar — the caller owns the frame.
 */
export function TaskEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const today = todayKey();
  const { data: tasks = [] } = useTasks();
  const { data: skipped } = useSkippedOccurrences();
  const hours = usePrefs((s) => s.calendar);
  const task = useMemo(() => tasks.find((t) => t.id === id), [tasks, id]);

  const toggle = useToggleTask();
  const updateTask = useUpdateTask();
  const requestDelete = useTaskDelete();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<View>(null);

  // Nox AI: split this task into smaller steps, each with a length.
  const aiOn = useAiEnabled();
  const breakdown = useAiCall(AiRepository.breakdown);
  const createTask = useCreateTask();
  /** Indexes of the suggested steps the user has unticked. */
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  useEffect(() => {
    breakdown.reset();
    setDropped(new Set());
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed the text fields when the task first resolves (keyed on id so typing isn't clobbered by a refetch).
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = (
    <Pressable
      onPress={onClose}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Back to tasks"
      style={pressScale}
      className="hover:bg-chip -ml-2 h-[34px] flex-row items-center gap-0.5 rounded-[10px] pl-1 pr-2.5"
    >
      <ChevronLeft size={19} color={c.ink2} strokeWidth={2.2} />
      <Text className="text-ink-2 text-[14px] font-semibold">Tasks</Text>
    </Pressable>
  );

  if (!task) {
    return (
      <View className="px-screen flex-1 pt-3">
        {back}
        <Text className="text-ink mt-10 text-[17px] font-semibold">This task no longer exists</Text>
        <Text className="text-ink-3 mt-1 text-[14px]">It was deleted, possibly on another device.</Text>
      </View>
    );
  }

  const complete = task.status === "complete";
  const patch = (p: Partial<TaskInput>) => updateTask.mutate({ id: task.id, patch: p });
  const setDone = (done: boolean) => toggle.mutate({ id: task.id, status: done ? "complete" : "pending" });

  const freeSlot =
    task.due_date && !task.due_time
      ? findFreeSlot(tasksOnDay(tasks, task.due_date, today, skipped), task.duration_minutes || 30, {
          dayStart: hours.startHour * 60,
          dayEnd: hours.endHour * 60,
          notBefore: task.due_date === today ? new Date().getHours() * 60 + new Date().getMinutes() + 10 : 0,
        })
      : null;

  const props: TaskProps = {
    date: task.due_date,
    time: task.due_time ? task.due_time.slice(0, 5) : null,
    reminders: task.reminder_times,
    repeat: { kind: task.repeat, weekdays: task.repeat_config?.weekdays ?? [] },
    priority: task.priority,
    duration: task.duration_minutes ?? null,
  };

  const onChange = (p: Partial<TaskProps>) => {
    const out: Partial<TaskInput> = {};
    if ("date" in p) out.due_date = p.date ?? null;
    if ("time" in p) out.due_time = p.time ?? null;
    if (p.priority) out.priority = p.priority;
    if ("duration" in p) out.duration_minutes = p.duration ?? null;
    if (p.repeat) {
      out.repeat = p.repeat.kind;
      out.repeat_config = p.repeat.kind === "custom" ? { ...(task.repeat_config ?? {}), weekdays: p.repeat.weekdays } : null;
    }
    if (p.reminders) {
      out.reminder_times = p.reminders;
    } else if ("date" in p || "time" in p) {
      // Moving the task moves its reminders with it — "1 hour before" stays one hour before.
      const nextDate = "date" in p ? (p.date ?? null) : props.date;
      const nextTime = nextDate === null ? null : "time" in p ? (p.time ?? null) : props.time;
      const moved = rebaseReminders(task.reminder_times, anchorOf(props.date, props.time), anchorOf(nextDate, nextTime));
      if (moved !== task.reminder_times) out.reminder_times = moved;
    }
    patch(out);
  };

  const ring = { high: c.high, medium: c.medium, low: c.ink3 }[task.priority];
  const statusLines: { icon: typeof Repeat; text: string; tone: string }[] = [];
  if (complete) statusLines.push({ icon: CircleCheck, text: "Done", tone: c.success });
  if (task.status === "carried_over") statusLines.push({ icon: RotateCcw, text: "Carried over from an earlier day", tone: c.medium });
  if (task.origin_task_id !== null)
    statusLines.push({
      icon: Repeat,
      text: `One day of a repeating task${task.due_date ? ` — ${relativeDayLabel(task.due_date, today)}` : ""}`,
      tone: c.ink3,
    });

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 56, maxWidth: 680, width: "100%", alignSelf: "center", ...(isDesktop ? { paddingTop: 18 } : null) }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Top bar */}
        <View className="px-screen flex-row items-center justify-between pt-2">
          {back}
          <View ref={menuRef} collapsable={false}>
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="More options"
              style={pressScale}
              className={`h-[34px] w-[34px] items-center justify-center rounded-[10px] ${menuOpen ? "bg-chip" : "hover:bg-chip"}`}
            >
              <MoreHorizontal size={19} color={c.ink2} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* The task */}
        <View className="px-screen mt-6">
          <View className="flex-row items-start">
            <Pressable
              onPress={() => setDone(!complete)}
              hitSlop={10}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: complete }}
              accessibilityLabel={complete ? "Mark as not done" : "Mark as done"}
              style={pressScale}
              className="mt-[5px]"
            >
              {complete ? (
                <View className="bg-accent h-[24px] w-[24px] items-center justify-center rounded-full">
                  <Check size={14} color={c.onAccent} strokeWidth={2.8} />
                </View>
              ) : (
                <View
                  className="h-[24px] w-[24px] rounded-full"
                  style={{
                    borderWidth: task.priority === "low" ? 1.5 : 2,
                    borderColor: ring,
                    backgroundColor: task.priority === "low" ? "transparent" : `${ring}1f`,
                  }}
                />
              )}
            </Pressable>
            <AutoGrowInput
              value={title}
              onChangeText={setTitle}
              onBlur={() => {
                const t = title.trim();
                if (t && t !== task.title) patch({ title: t.slice(0, 200) });
                else if (!t) setTitle(task.title);
              }}
              placeholder="What needs doing?"
              placeholderTextColor={c.ink3}
              maxLength={200}
              minHeight={34}
              accessibilityLabel="Task name"
              className={`ml-3 flex-1 font-serif text-[24px] font-bold leading-[34px] tracking-[-0.01em] ${complete ? "text-ink-3 line-through" : "text-ink"}`}
            />
          </View>

          <View style={{ paddingLeft: TEXT_INDENT }}>
            <AutoGrowInput
              value={notes}
              onChangeText={setNotes}
              onBlur={() => {
                const next = notes.trim() ? notes.trim().slice(0, 2000) : null;
                if (next !== (task.notes ?? null)) patch({ notes: next });
              }}
              placeholder="Notes"
              placeholderTextColor={c.ink3}
              maxLength={2000}
              minHeight={24}
              accessibilityLabel="Notes"
              className="text-ink-2 mt-1 text-[15px] leading-[23px]"
              style={{ textAlignVertical: "top" }}
            />

            {statusLines.length > 0 && (
              <View className="mt-3 gap-1.5">
                {statusLines.map(({ icon: Icon, text, tone }) => (
                  <View key={text} className="flex-row items-center gap-2">
                    <Icon size={13} color={tone} strokeWidth={2.2} />
                    <Text className="text-[13px] font-medium" style={{ color: tone }}>
                      {text}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View className="mt-5" style={{ paddingLeft: isDesktop ? TEXT_INDENT : 0 }}>
          <PropertyBar value={props} onChange={onChange} today={today} compact={!isDesktop} />
          {/* A dated task with no time isn't on the calendar grid yet: offer the next free slot. */}
          {task.due_date && !task.due_time && !complete && task.due_date >= today && (
            <View className="mt-3 flex-row flex-wrap items-center gap-2" style={{ paddingHorizontal: 14 }}>
              <Text className="text-ink-3 text-[13px]">Not on your calendar yet.</Text>
              {freeSlot ? (
                <Pressable
                  onPress={() => onChange({ time: freeSlot })}
                  accessibilityRole="button"
                  style={pressScale}
                  className="bg-accent/[0.1] hover:bg-accent/[0.16] flex-row items-center gap-1.5 rounded-[8px] px-2.5 py-1"
                >
                  <Sparkles size={12} color={c.accent} strokeWidth={2.4} />
                  <Text className="text-accent text-[13px] font-semibold">Schedule at {formatTime12(freeSlot)}</Text>
                </Pressable>
              ) : (
                <Text className="text-ink-3 text-[13px]">No free time left in your calendar hours that day.</Text>
              )}
            </View>
          )}
        </View>

        {aiOn && !complete && (
          <View className="mt-5" style={{ paddingLeft: isDesktop ? TEXT_INDENT + 14 : 20, paddingRight: 20 }}>
            {breakdown.result && breakdown.result.subtasks.length > 0 ? (
              (() => {
                const steps = breakdown.result.subtasks;
                const kept = steps.filter((_, i) => !dropped.has(i));
                const close = () => {
                  breakdown.reset();
                  setDropped(new Set());
                };
                return (
                  <AiPanel
                    title="Smaller steps"
                    onClose={close}
                    footer={
                      <>
                        <AiAction
                          label="Add to notes"
                          onPress={() => {
                            const lines = kept.map((st) => `• ${st.title} (${durationLabel(st.minutes)})`).join("\n");
                            const next = [notes.trim(), lines].filter(Boolean).join("\n\n").slice(0, 2000);
                            setNotes(next);
                            patch({ notes: next });
                            close();
                          }}
                        />
                        <AiAction
                          primary
                          label={`Add ${kept.length} as tasks`}
                          onPress={() => {
                            for (const st of kept) {
                              createTask.create({
                                title: st.title.slice(0, 200),
                                notes: `Part of “${task.title}”`.slice(0, 2000),
                                due_date: task.due_date,
                                due_time: null,
                                duration_minutes: st.minutes,
                                reminder_times: [],
                                priority: task.priority,
                                repeat: "none",
                                repeat_config: null,
                              });
                            }
                            close();
                          }}
                        />
                      </>
                    }
                  >
                    {steps.map((st, i) => {
                      const on = !dropped.has(i);
                      return (
                        <Pressable
                          key={i}
                          onPress={() =>
                            setDropped((d) => {
                              const n = new Set(d);
                              if (n.has(i)) n.delete(i);
                              else n.add(i);
                              return n;
                            })
                          }
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          className="flex-row items-center gap-2.5 py-1"
                        >
                          <View
                            className="h-[18px] w-[18px] items-center justify-center rounded-[5px]"
                            style={{ borderWidth: on ? 0 : 1.5, borderColor: c.ink3, backgroundColor: on ? c.accent : "transparent" }}
                          >
                            {on && <Check size={12} color={c.onAccent} strokeWidth={3} />}
                          </View>
                          <Text className={`flex-1 text-[14px] ${on ? "text-ink" : "text-ink-3 line-through"}`}>{st.title}</Text>
                          <Text style={TABULAR} className="text-ink-3 text-[12px]">
                            {durationLabel(st.minutes)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </AiPanel>
                );
              })()
            ) : (
              <View className="flex-row flex-wrap items-center gap-2">
                <AiButton label="Break it down" onPress={() => void breakdown.run(task.title, notes)} busy={breakdown.busy} />
                {breakdown.error ? <Text className="text-high flex-1 text-[13px]">{breakdown.error}</Text> : null}
              </View>
            )}
          </View>
        )}

        <View className="bg-line mx-[20px] mt-8 h-px" />
        <Text style={TABULAR} className="text-ink-3 px-screen mt-3 text-[13px]">
          Created {shortDate(task.created_at)} · Edited {relativeFromNow(task.updated_at)}
          {isDesktop ? " · Changes save automatically" : ""}
        </Text>
      </ScrollView>

      <Popover anchorRef={menuRef} open={menuOpen} onClose={() => setMenuOpen(false)} width={220} accessibilityLabel="Task options">
        <View className="p-1.5">
          <MenuRow
            label={complete ? "Mark as not done" : "Mark as done"}
            icon={complete ? <CircleDashed size={15} color={c.ink2} strokeWidth={2} /> : <CircleCheck size={15} color={c.ink2} strokeWidth={2} />}
            trailing={<View />}
            onPress={() => {
              setMenuOpen(false);
              setDone(!complete);
            }}
          />
          <MenuDivider />
          <MenuRow
            label={isRepeating(task) ? "Delete…" : "Delete task"}
            danger
            icon={<Trash2 size={15} color={c.high} strokeWidth={2} />}
            trailing={<View />}
            onPress={() => {
              setMenuOpen(false);
              // Closes only once something is deleted — cancelling the prompt keeps the editor open.
              requestDelete(task, onClose);
            }}
          />
        </View>
      </Popover>
    </View>
  );
}
