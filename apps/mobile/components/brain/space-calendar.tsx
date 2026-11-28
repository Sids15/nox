import { useThemeColors, useToggleTask } from "@nox/features";
import type { Space, Task } from "@nox/types";
import { capitalize, formatTime12, relativeDayLabel, toDateKey, todayKey } from "@nox/utils";
import { router } from "expo-router";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useIsDesktop } from "../../lib/use-responsive";
import { TABULAR } from "../menu";
import { Popover } from "../popover";
import { NewTaskDialog } from "../tasks/new-task-dialog";
import { TimePicker } from "../tasks/time-picker";
import { usePages } from "./pages";
import { useQuickAdd } from "./use-quick-add";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Untimed tasks first ("all day"), then by time. */
const byTime = (a: Task, b: Task) => (a.due_time ?? "").localeCompare(b.due_time ?? "");

/**
 * This space's tasks on a month. Pick a day, type a task, pick a time: it's an ordinary task, so it
 * also shows on the Tasks page on that day and time, marked with this space.
 */
export function SpaceCalendar({ space }: { space: Space }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const pages = usePages();
  const toggle = useToggleTask();
  const quickAdd = useQuickAdd();
  const today = todayKey();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [picked, setPicked] = useState<string>(today);
  const [draft, setDraft] = useState("");
  const [time, setTime] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const timeRef = useRef<View>(null);
  // The full task composer on the picked day, started from what's typed.
  const [composing, setComposing] = useState<string | null>(null);

  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    setDraft("");
    setTime(null);
    // Words in the text ("3pm", "friday") still win over the picked day and time.
    void quickAdd(raw, "task", { spaceId: space.id, date: picked, time });
  };

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of pages.tasks) {
      if (t.space_id !== space.id || t.deleted || !t.due_date || (t.repeat !== "none" && t.origin_task_id === null)) continue;
      m.set(t.due_date, [...(m.get(t.due_date) ?? []), t]);
    }
    for (const list of m.values()) list.sort(byTime);
    return m;
  }, [pages.tasks, space.id]);

  // The month's grid: whole weeks, Sunday first, with the edges of the months around it.
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const first = new Date(y, mo - 1, 1);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => toDateKey(new Date(y, mo - 1, 1 - first.getDay() + i)));
  const shift = (n: number) => setMonth(toDateKey(new Date(y, mo - 1 + n, 1)).slice(0, 7));
  const label = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayTasks = byDay.get(picked) ?? [];
  const cellH = isDesktop ? 92 : 50;

  return (
    <View>
      <View className="mb-2 flex-row items-center gap-1">
        <Text className="text-ink flex-1 text-[16px] font-semibold">{label}</Text>
        <Pressable
          onPress={() => {
            setMonth(today.slice(0, 7));
            setPicked(today);
          }}
          accessibilityRole="button"
          className="hover:bg-chip rounded-[8px] px-2.5 py-1"
        >
          <Text className="text-ink-2 text-[13px] font-medium">Today</Text>
        </Pressable>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]">
          <ChevronLeft size={16} color={c.ink2} strokeWidth={2.2} />
        </Pressable>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]">
          <ChevronRight size={16} color={c.ink2} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View className="border-line overflow-hidden rounded-[12px] border">
        <View className="bg-surface border-line flex-row border-b">
          {WEEK.map((d) => (
            <Text key={d} className="text-ink-3 flex-1 py-1.5 text-center text-[11px] font-semibold">
              {isDesktop ? d : d[0]}
            </Text>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, w) => (
          <View key={w} className={`flex-row ${w > 0 ? "border-line border-t" : ""}`}>
            {cells.slice(w * 7, w * 7 + 7).map((key, i) => {
              const items = byDay.get(key) ?? [];
              const inMonth = key.startsWith(month);
              const on = key === picked;
              const isToday = key === today;
              return (
                <Pressable
                  key={key}
                  onPress={() => setPicked(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${key}, ${items.length} tasks`}
                  className={`flex-1 p-1 ${i > 0 ? "border-line border-l" : ""} ${on ? "bg-accent/[0.08]" : "hover:bg-chip"}`}
                  style={{ height: cellH, opacity: inMonth ? 1 : 0.45 }}
                >
                  <View className={`h-[20px] w-[20px] items-center justify-center rounded-full ${isToday ? "bg-accent" : ""}`}>
                    <Text style={TABULAR} className={`text-[11px] font-semibold ${isToday ? "text-on-accent" : "text-ink-2"}`}>
                      {Number(key.slice(8))}
                    </Text>
                  </View>
                  {isDesktop ? (
                    <View className="mt-0.5 gap-[2px]">
                      {items.slice(0, 3).map((t) => (
                        <Text key={t.id} numberOfLines={1} className={`text-[11px] ${t.status === "complete" ? "text-ink-3 line-through" : "text-ink-2"}`}>
                          {t.due_time ? <Text style={TABULAR} className="text-ink-3">{`${formatTime12(t.due_time)} `}</Text> : null}
                          {t.title}
                        </Text>
                      ))}
                      {items.length > 3 ? <Text className="text-ink-3 text-[11px]">+{items.length - 3} more</Text> : null}
                    </View>
                  ) : items.length > 0 ? (
                    <View className="mt-1 flex-row justify-center gap-[3px]">
                      {items.slice(0, 3).map((t) => (
                        <View key={t.id} className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: t.status === "complete" ? c.ink3 : c.accent }} />
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* The picked day: add a task to it (with a time), and its tasks. */}
      <Text className="text-ink-3 mb-1 mt-4 text-[12px] font-semibold">{capitalize(relativeDayLabel(picked, today))}</Text>
      <View className="bg-surface border-line mb-1 flex-row items-center gap-1 rounded-[10px] border py-1 pl-3 pr-1">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={`Add a task on ${relativeDayLabel(picked, today)}…`}
          placeholderTextColor={c.ink3}
          returnKeyType="done"
          maxLength={200}
          accessibilityLabel="Add a task on this day"
          className="text-ink flex-1 text-[14px]"
          style={{ paddingVertical: 6 }}
        />
        <View ref={timeRef} collapsable={false}>
          <Pressable
            onPress={() => setTimeOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={time ? `Time ${formatTime12(time)}` : "Pick a time"}
            className={`h-[28px] flex-row items-center gap-1 rounded-[8px] px-2 ${time ? "bg-accent/[0.12]" : "hover:bg-chip"}`}
          >
            <Clock size={13} color={time ? c.accent : c.ink3} strokeWidth={2} />
            <Text style={TABULAR} className={`text-[13px] font-medium ${time ? "text-accent" : "text-ink-3"}`}>
              {time ? formatTime12(time) : "Time"}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            setComposing(draft.trim());
            setDraft("");
          }}
          accessibilityRole="button"
          accessibilityLabel="Add a task with priority, repeat, length or reminders"
          className="hover:bg-chip h-[28px] justify-center rounded-[8px] px-2"
        >
          <Text className="text-ink-2 text-[13px] font-medium">Details</Text>
        </Pressable>
        <Pressable onPress={add} disabled={!draft.trim()} accessibilityRole="button" className="bg-accent h-[28px] justify-center rounded-[8px] px-3" style={{ opacity: draft.trim() ? 1 : 0.5 }}>
          <Text className="text-on-accent text-[13px] font-semibold">Add</Text>
        </Pressable>
      </View>
      <Popover anchorRef={timeRef} open={timeOpen} onClose={() => setTimeOpen(false)} width={isDesktop ? 470 : 360} accessibilityLabel="Time">
        <View className="p-2.5">
          <TimePicker
            value={time}
            compact={!isDesktop}
            onChange={(t) => {
              setTime(t);
              setTimeOpen(false);
            }}
          />
        </View>
      </Popover>

      <NewTaskDialog
        visible={composing !== null}
        initialDate={picked}
        initialTime={time}
        initialTitle={composing ?? ""}
        spaceId={space.id}
        onClose={() => {
          setComposing(null);
          setTime(null);
        }}
      />

      {dayTasks.length === 0 ? (
        <Text className="text-ink-3 mt-1 text-[13px]">No tasks on this day. Tasks you add here also show on your Tasks page, marked with this space.</Text>
      ) : (
        dayTasks.map((t) => {
          const done = t.status === "complete";
          return (
            <View key={t.id} className="hover:bg-chip -mx-2 flex-row items-center gap-2.5 rounded-[8px] px-2 py-2">
              <Pressable onPress={() => toggle.mutate({ id: t.id, status: done ? "pending" : "complete" })} hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={t.title}>
                {done ? <CheckCircle2 size={17} color={c.accent} strokeWidth={2} /> : <Circle size={17} color={c.ink3} strokeWidth={2} />}
              </Pressable>
              <Pressable onPress={() => router.push(`/task/${t.id}`)} accessibilityRole="link" className="min-w-0 flex-1 flex-row items-center gap-2">
                <Text numberOfLines={1} className={`flex-1 text-[14px] ${done ? "text-ink-3 line-through" : "text-ink"}`}>
                  {t.title}
                </Text>
                <Text style={TABULAR} className="text-ink-3 text-[12px]">
                  {t.due_time ? formatTime12(t.due_time) : "All day"}
                </Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}
