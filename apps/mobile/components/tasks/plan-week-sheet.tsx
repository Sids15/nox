import { planWeek, usePrefs, useSkippedOccurrences, useTasks, useThemeColors, useThemeVars, useUpdateTask } from "@nox/features";
import type { Task } from "@nox/types";
import { capitalize, formatTime12, relativeDayLabel, todayKey } from "@nox/utils";
import { CalendarClock, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { pressScale, TABULAR } from "../menu";
import { anchorOf, rebaseReminders } from "./task-properties";

const nowMinute = () => {
  const d = new Date();
  // A few minutes' grace, so the first slot isn't already starting.
  return d.getHours() * 60 + d.getMinutes() + 10;
};

/**
 * "Plan my week": every open task that needs a time — overdue ones, the week's tasks with a day but no
 * time, and (if you like) tasks with no day — fitted into the free time in your calendar hours, most
 * urgent first. Shown as a plan; nothing moves until Schedule.
 */
export function PlanWeekSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const { data: tasks = [] } = useTasks();
  const { data: skipped } = useSkippedOccurrences();
  const cal = usePrefs((s) => s.calendar);
  const update = useUpdateTask();
  const [undated, setUndated] = useState(false);
  const today = todayKey();

  const plan = useMemo(
    () =>
      visible
        ? planWeek(tasks, today, {
            dayStart: cal.startHour * 60,
            dayEnd: cal.endHour * 60,
            nowMinute: nowMinute(),
            includeUndated: undated,
            ...(skipped ? { skipped } : {}),
          })
        : { placed: [], unplaced: [] },
    [visible, tasks, today, cal.startHour, cal.endHour, undated, skipped],
  );
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t] as const)), [tasks]);
  const groups = new Map<string, { task: Task; time: string }[]>();
  for (const p of plan.placed) {
    const task = byId.get(p.id);
    if (task) groups.set(p.day, [...(groups.get(p.day) ?? []), { task, time: p.time }].sort((a, b) => a.time.localeCompare(b.time)));
  }
  const days = [...groups.keys()].sort();

  const apply = () => {
    for (const p of plan.placed) {
      const t = byId.get(p.id);
      if (!t) continue;
      update.mutate({
        id: t.id,
        patch: { due_date: p.day, due_time: p.time, reminder_times: rebaseReminders(t.reminder_times, anchorOf(t.due_date, t.due_time), anchorOf(p.day, p.time)) },
      });
    }
    onClose();
  };

  if (!visible) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/50 px-5">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[520px] border p-4" style={{ maxHeight: "85%" }}>
          <View className="flex-row items-center gap-2">
            <CalendarClock size={17} color={c.accent} strokeWidth={2} />
            <Text className="text-ink flex-1 text-[17px] font-semibold">Plan my week</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" className="hover:bg-chip h-7 w-7 items-center justify-center rounded-[8px]">
              <X size={16} color={c.ink3} strokeWidth={2} />
            </Pressable>
          </View>
          <Text className="text-ink-3 mt-1 text-[13px] leading-[18px]">
            Overdue tasks and this week's tasks without a time, fitted into your free time between {formatTime12(`${String(cal.startHour).padStart(2, "0")}:00`)} and{" "}
            {formatTime12(`${String(cal.endHour % 24).padStart(2, "0")}:00`)}. Most urgent first.
          </Text>
          <View className="mt-3 flex-row items-center">
            <Text className="text-ink-2 flex-1 text-[14px]">Include tasks with no date</Text>
            <Switch value={undated} onValueChange={setUndated} accessibilityLabel="Include tasks with no date" />
          </View>

          <ScrollView className="mt-3" style={{ flexGrow: 0 }}>
            {days.length === 0 ? (
              <Text className="text-ink-3 py-6 text-center text-[14px]">
                {plan.unplaced.length > 0 ? "No free time left in your hours this week." : "Nothing to plan: every task with a day already has a time."}
              </Text>
            ) : (
              days.map((day) => (
                <View key={day} className="mb-3">
                  <Text className="text-ink-3 mb-1 text-[12px] font-semibold">{capitalize(relativeDayLabel(day, today))}</Text>
                  {groups.get(day)!.map(({ task, time }) => (
                    <View key={task.id} className="flex-row items-center gap-3 py-1">
                      <Text style={TABULAR} className="text-accent w-[64px] text-[13px] font-semibold">
                        {formatTime12(time)}
                      </Text>
                      <Text numberOfLines={1} className="text-ink flex-1 text-[14px]">
                        {task.title}
                      </Text>
                      <Text style={TABULAR} className="text-ink-3 text-[12px]">
                        {task.duration_minutes || 30}m
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
          {plan.unplaced.length > 0 && days.length > 0 ? (
            <Text className="text-ink-3 mt-1 text-[12px]">
              {plan.unplaced.length} didn't fit and stay as they are. Widen your calendar hours in the calendar's settings to fit more.
            </Text>
          ) : null}

          <View className="mt-4 flex-row justify-end gap-2">
            <Pressable onPress={onClose} accessibilityRole="button" className="hover:bg-chip h-[38px] justify-center rounded-[10px] px-4">
              <Text className="text-ink-2 text-[14px] font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={apply}
              disabled={plan.placed.length === 0}
              accessibilityRole="button"
              style={(st) => ({ ...pressScale(st), opacity: plan.placed.length ? 1 : 0.5 })}
              className="bg-accent h-[38px] justify-center rounded-[10px] px-4"
            >
              <Text className="text-on-accent text-[14px] font-semibold">Schedule {plan.placed.length || ""}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
