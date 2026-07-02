import { useDeleteTask, useTasks, useToggleTask, useUpdateTask } from "@nox/features";
import { taskPriorityLevels, repeatKinds, type Task, type TaskInput } from "@nox/types";
import { dark } from "@nox/ui";
import { formatTime12, relativeDayLabel, toDateKey } from "@nox/utils";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, Check, ChevronLeft, Clock, MoreHorizontal, Plus, Repeat, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SegmentedControl } from "../../components/tasks/segmented-control";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  low: dark.ink3,
  medium: dark.medium,
  high: dark.high,
};
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

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}
function timeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function relativeFromNow(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type PickerState = { mode: "date" | "time"; target: "due" | "reminder" };

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
          <Pressable onPress={goBack} hitSlop={8} className="bg-chip rounded-pill -ml-1 h-9 w-9 items-center justify-center">
            <ChevronLeft size={22} color={dark.ink} strokeWidth={1.7} />
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
  const cycleRepeat = () => {
    const i = repeatKinds.indexOf(task.repeat);
    patch({ repeat: repeatKinds[(i + 1) % repeatKinds.length]! });
  };

  const dueTime = formatTime12(task.due_time);

  return (
    <SafeAreaView className="bg-bg flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Nav */}
        <View className="px-screen flex-row items-center justify-between pt-2">
          <Pressable onPress={goBack} hitSlop={8} accessibilityLabel="Go back" className="bg-chip rounded-pill -ml-1 h-9 w-9 items-center justify-center">
            <ChevronLeft size={22} color={dark.ink} strokeWidth={1.7} />
          </Pressable>
          <Pressable hitSlop={8} className="bg-chip rounded-pill h-9 w-9 items-center justify-center">
            <MoreHorizontal size={20} color={dark.ink2} strokeWidth={1.7} />
          </Pressable>
        </View>

        {/* Title + checkbox */}
        <View className="px-screen mt-6 flex-row items-start">
          <Pressable
            onPress={() => toggle.mutate({ id: task.id, status: complete ? "pending" : "complete" })}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: complete }}
            className="mt-1.5"
          >
            {complete ? (
              <View className="bg-accent h-[26px] w-[26px] items-center justify-center rounded-full">
                <Check size={16} color={dark.onAccent} strokeWidth={2.5} />
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
            placeholderTextColor={dark.ink3}
            className={`ml-3 flex-1 text-[22px] font-bold ${complete ? "text-ink-3 line-through" : "text-ink"}`}
          />
        </View>

        {/* Chips */}
        <View className="px-screen mt-3 flex-row gap-2">
          <View className={`rounded-pill px-3 py-1.5 ${PRIORITY_SOFT[task.priority]}`}>
            <Text className="text-[12px] font-semibold" style={{ color: PRIORITY_COLOR[task.priority] }}>
              {cap(task.priority)} priority
            </Text>
          </View>
          <View className="bg-chip rounded-pill px-3 py-1.5">
            <Text className="text-ink-2 text-[12px] font-semibold">
              {task.due_date ? cap(relativeDayLabel(task.due_date)) : "No date"}
            </Text>
          </View>
        </View>

        {/* SCHEDULE */}
        <Text className="px-screen text-ink-3 mb-2 mt-7 font-mono text-[10px] font-semibold tracking-[1.4px]">SCHEDULE</Text>
        <View className="mx-[20px] border-line bg-surface rounded-card overflow-hidden border">
          {/* Due */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-row items-center">
              <Clock size={16} color={dark.ink2} strokeWidth={1.7} />
              <Text className="text-ink ml-3 text-[15px]">Due</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => openPicker({ mode: "date", target: "due" }, task.due_date ? dateFromKey(task.due_date) : new Date())}>
                <Text className="text-accent text-[14px] font-medium">
                  {task.due_date ? cap(relativeDayLabel(task.due_date)) : "Add date"}
                </Text>
              </Pressable>
              {task.due_date && (
                <Pressable onPress={() => openPicker({ mode: "time", target: "due" }, new Date())}>
                  <Text className="text-accent text-[14px] font-medium">{dueTime ?? "Add time"}</Text>
                </Pressable>
              )}
              {task.due_date && (
                <Pressable onPress={() => patch({ due_date: null, due_time: null })} hitSlop={6}>
                  <X size={15} color={dark.ink3} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          </View>
          <View className="bg-line ml-4 h-px" />

          {/* Reminders */}
          <View className="px-4 py-3">
            <View className="flex-row items-center">
              <Bell size={16} color={dark.ink2} strokeWidth={1.7} />
              <Text className="text-ink ml-3 text-[15px]">Reminders</Text>
            </View>
            <View className="ml-7 mt-2 flex-row flex-wrap gap-2">
              {task.reminder_times.map((iso) => (
                <Pressable key={iso} onPress={() => removeReminder(iso)} className="bg-chip rounded-pill flex-row items-center px-2.5 py-1">
                  <Text className="text-ink-2 font-mono text-[12px]">{formatTime12(timeString(new Date(iso)))}</Text>
                  <X size={12} color={dark.ink3} strokeWidth={2} style={{ marginLeft: 4 }} />
                </Pressable>
              ))}
              <Pressable
                onPress={() => openPicker({ mode: "time", target: "reminder" }, new Date())}
                className="border-accent-line rounded-pill flex-row items-center border border-dashed px-2.5 py-1"
              >
                <Plus size={12} color={dark.accent} strokeWidth={2} />
                <Text className="text-accent ml-1 text-[12px] font-medium">Add</Text>
              </Pressable>
            </View>
          </View>
          <View className="bg-line ml-4 h-px" />

          {/* Repeat */}
          <Pressable onPress={cycleRepeat} className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-row items-center">
              <Repeat size={16} color={dark.ink2} strokeWidth={1.7} />
              <Text className="text-ink ml-3 text-[15px]">Repeat</Text>
            </View>
            <Text className="text-ink-2 text-[14px] font-medium">{REPEAT_LABEL[task.repeat]}</Text>
          </Pressable>
        </View>

        {/* PRIORITY */}
        <Text className="px-screen text-ink-3 mb-2 mt-7 font-mono text-[10px] font-semibold tracking-[1.4px]">PRIORITY</Text>
        <View className="px-screen">
          <SegmentedControl
            value={task.priority}
            onChange={(p) => patch({ priority: p })}
            options={taskPriorityLevels.map((p) => ({ value: p, label: cap(p), color: PRIORITY_COLOR[p] }))}
          />
        </View>

        {/* NOTES */}
        <Text className="px-screen text-ink-3 mb-2 mt-7 font-mono text-[10px] font-semibold tracking-[1.4px]">NOTES</Text>
        <View className="mx-[20px] border-line bg-surface rounded-card border px-4 py-3">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={() => {
              const next = notes.trim() ? notes : null;
              if (next !== (task.notes ?? null)) patch({ notes: next });
            }}
            multiline
            placeholder="Add notes…"
            placeholderTextColor={dark.ink3}
            className="text-ink-2 min-h-[64px] text-[15px] leading-6"
            style={{ textAlignVertical: "top" }}
          />
        </View>

        {/* Meta */}
        <Text className="text-ink-3 mt-6 text-center font-mono text-[10.5px]">
          created {shortDate(task.created_at).toLowerCase()} · updated {relativeFromNow(task.updated_at)}
        </Text>

        {/* Delete */}
        <View className="px-screen mt-4">
          <Pressable
            onPress={() => {
              del.mutate(task.id);
              goBack();
            }}
            className="bg-high-soft rounded-input items-center py-3"
          >
            <Text className="text-high font-semibold">Delete task</Text>
          </Pressable>
        </View>
      </ScrollView>

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
          <DateTimePicker
            value={temp}
            mode={picker.mode}
            display="spinner"
            themeVariant="dark"
            textColor={dark.ink}
            onChange={(_event, selected) => {
              if (selected) setTemp(selected);
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
