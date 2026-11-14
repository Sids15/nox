import { tasksOnDay, timeToMinutes, useTasks, useThemeColors } from "@nox/features";
import { formatTime12, relativeDayLabel } from "@nox/utils";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { TABULAR } from "../menu";

const ROW = 30; // px per hour

/**
 * The day you're adding a task to, beside the composer on desktop: what's already scheduled, hour by
 * hour, with the new task drawn where it would land. Click a free hour to put it there. Untimed tasks
 * are counted at the top. Read-only otherwise.
 */
export function DayPreview({
  date,
  time,
  title,
  today,
  onPickTime,
}: {
  date: string | null;
  time: string | null;
  title: string;
  today: string;
  onPickTime: (t: string) => void;
}) {
  const c = useThemeColors();
  const { data: tasks = [] } = useTasks();
  const scroller = useRef<ScrollView>(null);
  const plan = useMemo(() => (date ? tasksOnDay(tasks, date, today).filter((p) => p.task.status !== "complete") : []), [tasks, date, today]);

  // Keep the new task in view as its time changes.
  const firstHour = useRef(0);
  useEffect(() => {
    if (!time) return;
    const y = (timeToMinutes(time) / 60 - firstHour.current) * ROW - 60;
    scroller.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, [time]);

  if (!date) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-ink-2 text-center text-[13.5px] font-semibold">No date</Text>
        <Text className="text-ink-3 mt-1 text-center text-[12.5px]">It goes on your list for whenever. Pick a day to see it in your schedule.</Text>
      </View>
    );
  }

  const timed = plan.filter((p) => p.task.due_time);
  const untimed = plan.length - timed.length;
  const mins = [...timed.map((p) => timeToMinutes(p.task.due_time!)), ...(time ? [timeToMinutes(time)] : [])];
  const start = Math.max(0, Math.min(7, ...mins.map((m) => Math.floor(m / 60))));
  const end = Math.min(24, Math.max(22, ...mins.map((m) => Math.ceil(m / 60) + 1)));
  firstHour.current = start;
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  const top = (m: number) => (m / 60 - start) * ROW;
  const label = relativeDayLabel(date, today);

  return (
    <View className="flex-1">
      <View className="border-line border-b px-4 pb-2.5 pt-4">
        <Text className="text-ink font-serif text-[16px] font-bold">{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
        <Text className="text-ink-3 mt-0.5 text-[12px]">
          {timed.length ? `${timed.length} scheduled` : "Nothing scheduled"}
          {untimed ? ` · ${untimed} anytime` : ""}
        </Text>
      </View>
      <ScrollView ref={scroller} className="flex-1" contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: hours.length * ROW, marginLeft: 50, marginRight: 12 }}>
          {hours.map((h) => (
            <Pressable
              key={h}
              onPress={() => onPickTime(`${String(h).padStart(2, "0")}:00`)}
              accessibilityRole="button"
              accessibilityLabel={`Set time to ${formatTime12(`${h}:00`)}`}
              className="border-line hover:bg-accent/[0.06] absolute left-0 right-0 border-t"
              style={{ top: (h - start) * ROW, height: ROW }}
            >
              <Text style={[TABULAR, { position: "absolute", left: -46, top: -7, width: 40, textAlign: "right" }]} className="text-ink-3 text-[10.5px]">
                {formatTime12(`${h}:00`)!.replace(":00", "")}
              </Text>
            </Pressable>
          ))}
          {timed.map(({ task, projected }) => (
            <View
              key={`${task.id}${projected ? "p" : ""}`}
              pointerEvents="none"
              className="bg-chip absolute left-1 right-0 justify-center rounded-[6px] px-2"
              style={{ top: top(timeToMinutes(task.due_time!)) + 1, height: ROW - 3, opacity: projected ? 0.7 : 1 }}
            >
              <Text numberOfLines={1} className="text-ink-2 text-[11.5px] font-medium">
                {formatTime12(task.due_time)} {task.title}
              </Text>
            </View>
          ))}
          {time && (
            <View
              pointerEvents="none"
              className="bg-accent absolute left-1 right-0 justify-center rounded-[6px] px-2"
              style={{ top: top(timeToMinutes(time)) + 1, height: ROW - 3, shadowColor: c.accent, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
            >
              <Text numberOfLines={1} className="text-on-accent text-[11.5px] font-semibold">
                {formatTime12(time)} {title || "New task"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      {!time && (
        <Text className="text-ink-3 border-line border-t px-4 py-2.5 text-[12px]">Anytime that day. Click an hour to schedule it.</Text>
      )}
    </View>
  );
}
