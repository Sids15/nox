import { useTasks, useThemeColors, useToggleTask, useUpdateTask } from "@nox/features";
import type { TaskInput } from "@nox/types";
import { relativeDayLabel, relativeFromNow, shortDate, todayKey } from "@nox/utils";
import { Check, ChevronLeft, MoreHorizontal, Repeat, RotateCcw } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIsDesktop } from "../../lib/use-responsive";
import { isRepeating, useTaskDelete } from "../../lib/use-task-delete";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { OverflowMenu } from "../overflow-menu";
import { anchorOf, PropertyBar, rebaseReminders, type TaskProps } from "./task-properties";

/**
 * The task editor — the same structure as the new-task dialog: a title line with its checkbox, notes
 * beneath, and the shared PropertyBar (Date · Time · Remind · Repeat · Priority). Every change saves
 * as you make it (title and notes when you leave the field).
 *
 * Driven by an `id` so it works both as the standalone /task/[id] screen and as the right-hand pane on
 * desktop; `onClose` is what Back and delete call. Renders no SafeAreaView / Sidebar — the caller owns
 * the frame.
 */
export function TaskEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const today = todayKey();
  const { data: tasks = [] } = useTasks();
  const task = useMemo(() => tasks.find((t) => t.id === id), [tasks, id]);

  const toggle = useToggleTask();
  const updateTask = useUpdateTask();
  const requestDelete = useTaskDelete();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // Seed the text fields when the task first resolves (keyed on id so typing isn't clobbered by a refetch).
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <View className="flex-1">
        <View className="px-screen pt-2">
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Go back" className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink-2 mt-8 text-[15px]">This task no longer exists.</Text>
        </View>
      </View>
    );
  }

  const complete = task.status === "complete";
  const patch = (p: Partial<TaskInput>) => updateTask.mutate({ id: task.id, patch: p });

  const props: TaskProps = {
    date: task.due_date,
    time: task.due_time ? task.due_time.slice(0, 5) : null,
    reminders: task.reminder_times,
    repeat: { kind: task.repeat, weekdays: task.repeat_config?.weekdays ?? [] },
    priority: task.priority,
  };

  const onChange = (p: Partial<TaskProps>) => {
    const out: Partial<TaskInput> = {};
    if ("date" in p) out.due_date = p.date ?? null;
    if ("time" in p) out.due_time = p.time ?? null;
    if (p.priority) out.priority = p.priority;
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
  const repeating = isRepeating(task);
  const eyebrow = complete ? "COMPLETED" : repeating ? "REPEATING TASK" : "TASK";

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48, maxWidth: 680, width: "100%", alignSelf: "center", ...(isDesktop ? { paddingTop: 20 } : null) }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Header: back · eyebrow · more */}
        <View className="px-screen flex-row items-center justify-between pt-2">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Go back"
              className="bg-chip rounded-pill hover:bg-elev h-[34px] w-[34px] items-center justify-center"
            >
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <Text className="text-ink-3 font-mono text-[10px] font-semibold tracking-[0.16em]">{eyebrow}</Text>
          </View>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            accessibilityLabel="More options"
            className="bg-chip rounded-pill hover:bg-elev h-[34px] w-[34px] items-center justify-center"
          >
            <MoreHorizontal size={20} color={c.ink2} strokeWidth={1.7} />
          </Pressable>
        </View>

        {/* Card: checkbox + title, notes, then the property bar */}
        <View className="border-line bg-surface rounded-card mx-[20px] mt-5 border pb-4">
          <View className="flex-row items-start px-[18px] pt-[18px]">
            <Pressable
              onPress={() => toggle.mutate({ id: task.id, status: complete ? "pending" : "complete" })}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: complete }}
              accessibilityLabel={complete ? "Mark as not done" : "Mark as done"}
              className="mt-[3px]"
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
              placeholder="Task name"
              placeholderTextColor={c.ink3}
              maxLength={200}
              minHeight={28}
              accessibilityLabel="Task name"
              className={`ml-3 flex-1 text-[21px] font-bold leading-[28px] tracking-[-0.02em] ${complete ? "text-ink-3 line-through" : "text-ink"}`}
            />
          </View>

          <View className="pl-[54px] pr-[18px]">
            <AutoGrowInput
              value={notes}
              onChangeText={setNotes}
              onBlur={() => {
                const next = notes.trim() ? notes.trim().slice(0, 2000) : null;
                if (next !== (task.notes ?? null)) patch({ notes: next });
              }}
              placeholder="Add notes"
              placeholderTextColor={c.ink3}
              maxLength={2000}
              minHeight={22}
              accessibilityLabel="Notes"
              className="text-ink-2 mt-1.5 text-[14.5px] leading-[22px]"
              style={{ textAlignVertical: "top" }}
            />

            {/* Status that the properties don't already say */}
            {(task.status === "carried_over" || task.origin_task_id !== null) && (
              <View className="mt-2.5 flex-row flex-wrap gap-1.5">
                {task.status === "carried_over" && (
                  <View className="bg-medium/[0.13] flex-row items-center gap-1 rounded-[6px] px-2 py-1">
                    <RotateCcw size={10} color={c.medium} strokeWidth={2.2} />
                    <Text className="text-medium font-mono text-[10px] font-semibold">CARRIED OVER</Text>
                  </View>
                )}
                {task.origin_task_id !== null && (
                  <View className="bg-chip flex-row items-center gap-1 rounded-[6px] px-2 py-1">
                    <Repeat size={10} color={c.ink3} strokeWidth={2.2} />
                    <Text className="text-ink-3 font-mono text-[10px] font-semibold">
                      ONE DAY OF A REPEATING TASK{task.due_date ? ` · ${relativeDayLabel(task.due_date, today).toUpperCase()}` : ""}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View className="border-line mx-[18px] mb-4 mt-4 border-t" />
          <PropertyBar value={props} onChange={onChange} today={today} compact={!isDesktop} inset={18} />
        </View>

        <Text className="text-ink-3 mt-4 text-center font-mono text-[10.5px]">
          created {shortDate(task.created_at).toLowerCase()} · updated {relativeFromNow(task.updated_at)} · saves as you go
        </Text>
      </ScrollView>

      <OverflowMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            label: complete ? "Mark as not done" : "Mark as done",
            onPress: () => toggle.mutate({ id: task.id, status: complete ? "pending" : "complete" }),
          },
          // Closes only once something is deleted — cancelling the prompt keeps the editor open.
          { label: "Delete task", destructive: true, onPress: () => requestDelete(task, onClose) },
        ]}
      />
    </View>
  );
}
