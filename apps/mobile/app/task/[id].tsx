import {
  useDeleteTask,
  usePrefs,
  useTasks,
  useThemeColors,
  useToggleTask,
  useUpdateTask,
} from "@nox/features";
import { taskPriorityLevels, type Task, type TaskInput } from "@nox/types";
import { formatTime12, relativeDayLabel, relativeFromNow, shortDate, toDateKey } from "@nox/utils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, Calendar, Check, ChevronLeft, MoreHorizontal, Plus, Repeat, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NoxDateTimePicker } from "../../components/date-time-picker";
import { DropdownChip } from "../../components/dropdown-chip";
import { OverflowMenu } from "../../components/overflow-menu";
import { SegmentedControl } from "../../components/tasks/segmented-control";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

const PRIORITY_SOFT: Record<Task["priority"], string> = {
  low: "bg-chip",
  medium: "bg-medium-soft",
  high: "bg-high-soft",
};
const REPEAT_LABEL: Record<Task["repeat"], string> = {
  none: "Never",
  daily: "Daily",
  weekly: "Weekly",
  weekdays: "Weekdays",
  custom: "Custom",
};
// Daily/Weekly are just Custom presets (all days / one day), so the menu offers Never (off),
// Weekdays (Mon–Fri), and Custom (pick days). Existing daily/weekly tasks still display + run.
const REPEAT_OPTS: { value: Task["repeat"]; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "weekdays", label: "Weekdays" },
  { value: "custom", label: "Custom" },
];
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]; // dow 0–6

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}
function timeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type PickerState = { mode: "date" | "time"; target: "due" | "reminder" };

export default function TaskDetailScreen() {
  const { id, new: newParam } = useLocalSearchParams<{ id: string; new?: string }>();
  const isNew = newParam === "1";
  const router = useRouter();
  const c = useThemeColors();
  const theme = usePrefs((s) => s.theme);
  const PRIORITY_COLOR: Record<Task["priority"], string> = {
    low: c.ink3,
    medium: c.medium,
    high: c.high,
  };
  const { data: tasks = [] } = useTasks();
  const task = useMemo(() => tasks.find((t) => t.id === id), [tasks, id]);

  const toggle = useToggleTask();
  const del = useDeleteTask();
  const updateTask = useUpdateTask();
  const patch = (p: Partial<TaskInput>) => task && updateTask.mutate({ id: task.id, patch: p });

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [temp, setTemp] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);

  // Seed the editable fields when the task first resolves (keyed on id so edits aren't clobbered).
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goBack = () => router.back();

  if (!task) {
    return (
      <SafeAreaView className="bg-bg flex-1">
        <View className="px-screen pt-2">
          <Pressable onPress={goBack} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink-2 mt-8 text-[15px]">Task not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const complete = task.status === "complete";

  const openPicker = (state: PickerState, initial: Date) => {
    setTemp(initial);
    setPicker(state);
  };
  const confirmPicker = () => {
    if (!picker) return;
    if (picker.target === "due") {
      if (picker.mode === "date") patch({ due_date: toDateKey(temp) });
      else patch({ due_time: timeString(temp) });
    } else {
      patch({ reminder_times: [...task.reminder_times, temp.toISOString()] });
    }
    setPicker(null);
  };
  const removeReminder = (iso: string) =>
    patch({ reminder_times: task.reminder_times.filter((r) => r !== iso) });
  const setRepeat = (repeat: Task["repeat"]) => {
    if (repeat === "custom") patch({ repeat, repeat_config: task.repeat_config ?? { weekdays: [] } });
    else patch({ repeat, repeat_config: null });
  };
  const toggleWeekday = (dow: number) => {
    const current = task.repeat_config?.weekdays ?? [];
    const next = current.includes(dow)
      ? current.filter((d) => d !== dow)
      : [...current, dow].sort((a, b) => a - b);
    patch({ repeat_config: { ...(task.repeat_config ?? {}), weekdays: next } });
  };

  const dueTime = formatTime12(task.due_time);

  return (
    <SafeAreaView className="bg-bg flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {/* Nav */}
        <View className="px-screen flex-row items-center justify-between pt-2">
          <Pressable onPress={goBack} hitSlop={8} accessibilityLabel="Go back" className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} accessibilityLabel="More options" className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <MoreHorizontal size={20} color={c.ink2} strokeWidth={1.7} />
          </Pressable>
        </View>

        {/* Title + checkbox */}
        <View className="px-screen mt-[22px] flex-row items-start">
          <Pressable
            onPress={() => toggle.mutate({ id: task.id, status: complete ? "pending" : "complete" })}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: complete }}
            className="mt-[3px]"
          >
            {complete ? (
              <View className="bg-accent h-[26px] w-[26px] items-center justify-center rounded-full">
                <Check size={16} color={c.onAccent} strokeWidth={2.5} />
              </View>
            ) : (
              <View className="border-ink-3 h-[26px] w-[26px] rounded-full border-[1.5px]" />
            )}
          </Pressable>
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={() => {
              const t = title.trim();
              if (t && t !== task.title) patch({ title: t });
              else if (!t) setTitle(task.title);
            }}
            multiline
            placeholder="Task title"
            placeholderTextColor={c.ink3}
            className={`ml-[14px] flex-1 text-[22px] font-bold leading-[27px] tracking-[-0.02em] ${complete ? "text-ink-3 line-through" : "text-ink"}`}
          />
        </View>

        {/* Chips */}
        <View className="px-screen mt-2.5 flex-row gap-2">
          <View className={`rounded-[8px] px-2.5 py-[5px] ${PRIORITY_SOFT[task.priority]}`}>
            <Text className="text-[11.5px] font-semibold" style={{ color: PRIORITY_COLOR[task.priority] }}>
              {cap(task.priority)} priority
            </Text>
          </View>
          <View className="bg-chip rounded-[8px] px-2.5 py-[5px]">
            <Text className="text-ink-2 text-[11.5px] font-semibold">
              {task.due_date ? cap(relativeDayLabel(task.due_date)) : "No date"}
            </Text>
          </View>
        </View>

        {/* SCHEDULE */}
        <Text className="px-screen text-ink-3 mb-2 mt-7 pl-[22px] font-mono text-[10px] font-semibold tracking-[0.14em]">SCHEDULE</Text>
        <View className="mx-[20px] border-line bg-surface rounded-card overflow-hidden border">
          {/* Due */}
          <View className="border-line min-h-[54px] flex-row items-center justify-between border-b px-[14px]">
            <View className="flex-row items-center">
              <Calendar size={17} color={c.ink3} strokeWidth={1.7} />
              <Text className="text-ink-2 ml-3 text-[14.5px]">Due</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() =>
                  openPicker(
                    { mode: "date", target: "due" },
                    task.due_date ? dateFromKey(task.due_date) : new Date(),
                  )
                }
                className="bg-accent/[0.14] rounded-[8px] px-2.5 py-1.5"
              >
                <Text className="text-accent text-[13px] font-semibold">
                  {task.due_date ? cap(relativeDayLabel(task.due_date)) : "Add date"}
                </Text>
              </Pressable>
              {task.due_date && (
                <Pressable
                  onPress={() => openPicker({ mode: "time", target: "due" }, new Date())}
                  className="bg-accent/[0.14] rounded-[8px] px-2.5 py-1.5"
                >
                  <Text className="text-accent text-[13px] font-semibold">{dueTime ?? "Add time"}</Text>
                </Pressable>
              )}
              {task.due_date && (
                <Pressable onPress={() => patch({ due_date: null, due_time: null })} hitSlop={6}>
                  <X size={15} color={c.ink3} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Reminders */}
          <View className="border-line min-h-[54px] flex-row items-center justify-between border-b px-[14px] py-2">
            <View className="flex-row items-center">
              <Bell size={17} color={c.ink3} strokeWidth={1.7} />
              <Text className="text-ink-2 ml-3 text-[14.5px]">Reminders</Text>
            </View>
            <View className="ml-3 max-w-[190px] flex-row flex-wrap justify-end gap-1.5">
              {task.reminder_times.map((iso) => (
                <Pressable key={iso} onPress={() => removeReminder(iso)} className="bg-chip rounded-[8px] flex-row items-center px-2.5 py-[7px]">
                  <Text className="text-ink font-mono text-[11.5px] font-semibold">{formatTime12(timeString(new Date(iso)))}</Text>
                  <X size={12} color={c.ink3} strokeWidth={2} style={{ marginLeft: 5 }} />
                </Pressable>
              ))}
              <Pressable
                onPress={() => openPicker({ mode: "time", target: "reminder" }, new Date())}
                className="border-accent/[0.5] rounded-[8px] flex-row items-center border border-dashed px-2.5 py-1.5"
              >
                <Plus size={12} color={c.accent} strokeWidth={2} />
                <Text className="text-accent ml-1 font-mono text-[11.5px] font-semibold">Add</Text>
              </Pressable>
            </View>
          </View>

          {/* Repeat */}
          <View
            className={`min-h-[54px] flex-row items-center justify-between px-[14px] ${
              task.repeat === "custom" ? "border-line border-b" : ""
            }`}
          >
            <View className="flex-row items-center">
              <Repeat size={17} color={c.ink3} strokeWidth={1.7} />
              <Text className="text-ink-2 ml-3 text-[14.5px]">Repeat</Text>
            </View>
            <DropdownChip
              label={REPEAT_LABEL[task.repeat]}
              value={task.repeat}
              options={REPEAT_OPTS}
              onSelect={setRepeat}
              minimal
            />
          </View>

          {/* Custom weekday picker */}
          {task.repeat === "custom" && (
            <View className="flex-row justify-between px-[14px] py-3">
              {WEEKDAY_LETTERS.map((letter, dow) => {
                const on = (task.repeat_config?.weekdays ?? []).includes(dow);
                return (
                  <Pressable
                    key={dow}
                    onPress={() => toggleWeekday(dow)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className={`h-9 w-9 items-center justify-center rounded-full ${on ? "bg-accent" : "bg-chip"}`}
                  >
                    <Text className={`text-[13px] font-semibold ${on ? "text-on-accent" : "text-ink-2"}`}>
                      {letter}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* PRIORITY */}
        <Text className="px-screen text-ink-3 mb-2 mt-7 pl-[22px] font-mono text-[10px] font-semibold tracking-[0.14em]">PRIORITY</Text>
        <View className="px-screen">
          <SegmentedControl
            value={task.priority}
            onChange={(p) => patch({ priority: p })}
            options={taskPriorityLevels.map((p) => ({ value: p, label: cap(p), color: PRIORITY_COLOR[p] }))}
          />
        </View>

        {/* NOTES */}
        <Text className="px-screen text-ink-3 mb-2 mt-7 pl-[22px] font-mono text-[10px] font-semibold tracking-[0.14em]">NOTES</Text>
        <View className="mx-[20px] border-line bg-surface rounded-card min-h-[92px] border p-[14px]">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={() => {
              const next = notes.trim() ? notes : null;
              if (next !== (task.notes ?? null)) patch({ notes: next });
            }}
            multiline
            placeholder="Add notes…"
            placeholderTextColor={c.ink3}
            className="text-ink-2 text-[14px] leading-[22px]"
            style={{ textAlignVertical: "top", paddingTop: 0, marginTop: -2 }}
          />
        </View>

        {/* Meta */}
        <Text className="text-ink-3 mt-[18px] text-center font-mono text-[10.5px] leading-[17px]">
          created {shortDate(task.created_at).toLowerCase()} · updated {relativeFromNow(task.updated_at)}
        </Text>

        {/* Add task (create mode); edit-mode delete lives in the … overflow menu */}
        {isNew && (
          <View className="px-screen mt-[14px]">
            <Pressable
              onPress={goBack}
              className="bg-accent items-center rounded-[14px] py-[13px]"
              style={{
                shadowColor: c.accent,
                shadowOpacity: 0.4,
                shadowRadius: 13,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              }}
            >
              <Text className="text-on-accent text-[14px] font-bold">Add task</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <OverflowMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            label: "Delete task",
            destructive: true,
            onPress: () => {
              del.mutate(task.id);
              goBack();
            },
          },
        ]}
      />

      {/* Date/time picker sheet */}
      {picker && (
        <View className="border-line bg-sheet absolute inset-x-0 bottom-0 border-t pb-8 pt-1">
          <View className="px-screen flex-row justify-between py-2">
            <Pressable onPress={() => setPicker(null)} hitSlop={8}>
              <Text className="text-ink-2 text-[15px]">Cancel</Text>
            </Pressable>
            <Pressable onPress={confirmPicker} hitSlop={8}>
              <Text className="text-accent text-[15px] font-semibold">Done</Text>
            </Pressable>
          </View>
          <NoxDateTimePicker value={temp} mode={picker.mode} theme={theme} textColor={c.ink} onChange={setTemp} />
        </View>
      )}
    </SafeAreaView>
  );
}
