import {
  FOCUS_LENGTHS,
  elapsedMs,
  formatClock,
  formatMinutes,
  isFinished,
  minutesToLog,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startTimer,
  useFocusSessions,
  useFocusStore,
  useLogFocus,
  useSpaces,
  useTasks,
  useThemeColors,
  useToggleTask,
  type FocusTimer,
} from "@nox/features";
import type { Task } from "@nox/types";
import { capitalize, relativeDayLabel, todayKey, toDateKey } from "@nox/utils";
import { useLocalSearchParams } from "expo-router";
import { Check, ChevronLeft, Circle, CircleCheck, Pause, Play, Plus, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SpaceMark } from "../components/brain/space-mark";
import { pressScale, TABULAR } from "../components/menu";
import { goBack } from "../lib/go-back";
import { useIsDesktop } from "../lib/use-responsive";

/** The clock, ticking once a second while something is running. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const isTemplate = (t: Task) => t.repeat !== "none" && t.origin_task_id === null;

/**
 * Focus: pick a task, pick a length, and work with one big clock. The minutes are logged against the
 * task and its space (Insights adds them up). The timer lives on the device, so leaving this page or
 * closing the app doesn't stop it.
 */
export default function FocusScreen() {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const params = useLocalSearchParams<{ task?: string }>();
  const timer = useFocusStore((s) => s.timer);
  const setTimer = useFocusStore((s) => s.setTimer);
  const { data: tasks = [] } = useTasks();
  const { data: spaces = [] } = useSpaces();
  const { data: sessions = [] } = useFocusSessions();
  const logFocus = useLogFocus();
  const toggle = useToggleTask();
  const now = useNow(!!timer && timer.pausedAt === null);
  const today = todayKey();

  // Today so far, across devices.
  const todays = sessions.filter((s) => toDateKey(new Date(s.started_at)) === today);
  const todayMinutes = todays.reduce((a, s) => a + s.minutes, 0);

  /** Save what was focused (if a minute or more) and clear the timer; optionally tick the task off. */
  const finish = (t: FocusTimer, markDone: boolean) => {
    const at = Date.now();
    const minutes = minutesToLog(t, at);
    if (minutes >= 1) {
      logFocus.log({ task_id: t.taskId, space_id: t.spaceId, started_at: new Date(t.startedAt).toISOString(), minutes });
    }
    if (markDone && t.taskId) toggle.mutate({ id: t.taskId, status: "complete" });
    setTimer(null);
  };

  const wrap = (body: React.ReactNode) => (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, ...(isDesktop ? { paddingTop: 16 } : null) }}>
        <View className="px-screen" style={{ maxWidth: 640, width: "100%", alignSelf: "center" }}>
          <View className="flex-row items-center gap-2 pt-2">
            <Pressable
              onPress={() => goBack("/tasks")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={pressScale}
              className="hover:bg-chip -ml-2 h-[34px] w-[34px] items-center justify-center rounded-[10px]"
            >
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <Text className="text-ink flex-1 font-serif text-[30px] font-bold tracking-[-0.01em]">Focus</Text>
            {todayMinutes > 0 ? (
              <Text style={TABULAR} className="text-ink-3 text-[13px] font-medium">
                {formatMinutes(todayMinutes)} today
              </Text>
            ) : null}
          </View>
          {body}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (!timer) {
    return wrap(
      <FocusSetup
        tasks={tasks}
        initialTaskId={typeof params.task === "string" ? params.task : null}
        onStart={(task, minutes) => setTimer(startTimer(task?.id ?? null, task?.space_id ?? null, minutes, Date.now()))}
      />,
    );
  }

  const task = timer.taskId ? tasks.find((t) => t.id === timer.taskId) : undefined;
  const space = timer.spaceId ? spaces.find((s) => s.id === timer.spaceId) : undefined;
  const done = isFinished(timer, now);
  const left = remainingMs(timer, now);
  const progress = elapsedMs(timer, now) / (timer.plannedMinutes * 60_000);
  const paused = timer.pausedAt !== null;

  const button = (label: string, onPress: () => void, icon: React.ReactNode, primary = false) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      style={pressScale}
      className={`h-[44px] flex-row items-center justify-center gap-2 rounded-[12px] px-5 ${primary ? "bg-accent" : "bg-chip hover:opacity-80"}`}
    >
      {icon}
      <Text className={`text-[15px] font-semibold ${primary ? "text-on-accent" : "text-ink-2"}`}>{label}</Text>
    </Pressable>
  );

  return wrap(
    <View className="items-center pt-10">
      {space ? (
        <View className="mb-2 flex-row items-center gap-1.5">
          <SpaceMark space={space} size={18} />
          <Text className="text-ink-3 text-[13px] font-medium">{space.name}</Text>
        </View>
      ) : null}
      <Text numberOfLines={2} className="text-ink-2 mb-6 text-center text-[17px] font-medium">
        {task?.title ?? (timer.taskId ? "A task" : "Just focusing")}
      </Text>
      <Text
        style={[TABULAR, { fontSize: 44, lineHeight: 52 }]}
        className={`font-bold ${done ? "text-accent" : paused ? "text-ink-3" : "text-ink"}`}
        accessibilityRole="timer"
        accessibilityLabel={done ? "Time's up" : `${formatClock(left)} left`}
      >
        {done ? "Time's up" : formatClock(left)}
      </Text>
      <View className="bg-chip mt-5 h-[6px] w-full max-w-[360px] overflow-hidden rounded-full">
        <View style={{ width: `${Math.min(1, progress) * 100}%`, height: "100%", backgroundColor: c.accent, borderRadius: 99 }} />
      </View>
      <Text className="text-ink-3 mt-2 text-[13px]">
        {done ? `${formatMinutes(timer.plannedMinutes)} focused` : paused ? "Paused" : `${formatMinutes(timer.plannedMinutes)} session`}
      </Text>

      <View className="mt-8 flex-row flex-wrap justify-center gap-2">
        {done ? (
          <>
            {timer.taskId ? button("Mark task done", () => finish(timer, true), <Check size={16} color={c.onAccent} strokeWidth={2.4} />, true) : null}
            {button(timer.taskId ? "Not done yet" : "Finish", () => finish(timer, false), <Check size={16} color={timer.taskId ? c.ink2 : c.onAccent} strokeWidth={2.4} />, !timer.taskId)}
            {button("5 more min", () => setTimer({ ...timer, plannedMinutes: Math.min(600, timer.plannedMinutes + 5) }), <Plus size={16} color={c.ink2} strokeWidth={2.4} />)}
          </>
        ) : (
          <>
            {paused
              ? button("Resume", () => setTimer(resumeTimer(timer, Date.now())), <Play size={16} color={c.onAccent} strokeWidth={2.4} />, true)
              : button("Pause", () => setTimer(pauseTimer(timer, Date.now())), <Pause size={16} color={c.onAccent} strokeWidth={2.4} />, true)}
            {button("Finish early", () => finish(timer, false), <Check size={16} color={c.ink2} strokeWidth={2.4} />)}
            {button("Cancel", () => setTimer(null), <X size={16} color={c.ink2} strokeWidth={2.4} />)}
          </>
        )}
      </View>
      {!done ? <Text className="text-ink-3 mt-4 text-center text-[12px]">Finishing early logs the minutes so far. Cancel logs nothing.</Text> : null}
    </View>,
  );
}

/** Before starting: what to work on, and for how long. */
function FocusSetup({ tasks, initialTaskId, onStart }: { tasks: Task[]; initialTaskId: string | null; onStart: (task: Task | null, minutes: number) => void }) {
  const c = useThemeColors();
  const { data: spaces = [] } = useSpaces();
  const today = todayKey();
  // Due today or late first (by time), then undated; a dozen is plenty to pick from.
  const choices = useMemo(
    () =>
      tasks
        .filter((t) => !t.deleted && t.status === "pending" && !isTemplate(t) && (!t.due_date || t.due_date <= today))
        .sort((a, b) => Number(!a.due_date) - Number(!b.due_date) || (a.due_date ?? "").localeCompare(b.due_date ?? "") || (a.due_time ?? "99").localeCompare(b.due_time ?? "99"))
        .slice(0, 12),
    [tasks, today],
  );
  const preset = initialTaskId ? tasks.find((t) => t.id === initialTaskId) : undefined;
  const list = preset && !choices.some((t) => t.id === preset.id) ? [preset, ...choices] : choices;
  const [picked, setPicked] = useState<string | null>(preset?.id ?? null);
  const pickedTask = list.find((t) => t.id === picked) ?? null;
  const lengths = useMemo(() => {
    const own = pickedTask?.duration_minutes;
    return [...new Set([...(own ? [own] : []), ...FOCUS_LENGTHS])].sort((a, b) => a - b);
  }, [pickedTask]);
  const [minutes, setMinutes] = useState<number>(preset?.duration_minutes ?? 25);
  useEffect(() => {
    if (pickedTask?.duration_minutes) setMinutes(pickedTask.duration_minutes);
  }, [pickedTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View className="mt-4">
      <Text className="text-ink-3 mb-1.5 text-[12px] font-semibold">What are you working on?</Text>
      <View className="border-line bg-surface overflow-hidden rounded-[12px] border">
        {[null, ...list].map((t, i) => {
          const on = (t?.id ?? null) === picked;
          const space = t?.space_id ? spaces.find((s) => s.id === t.space_id) : undefined;
          return (
            <Pressable
              key={t?.id ?? "none"}
              onPress={() => setPicked(t?.id ?? null)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              className={`flex-row items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-line border-t" : ""} ${on ? "bg-accent/[0.08]" : "hover:bg-chip"}`}
            >
              {on ? <CircleCheck size={17} color={c.accent} strokeWidth={2} /> : <Circle size={17} color={c.ink3} strokeWidth={2} />}
              <Text numberOfLines={1} className={`flex-1 text-[14px] ${t ? "text-ink" : "text-ink-2"}`}>
                {t?.title ?? "Just focus (no task)"}
              </Text>
              {space ? <SpaceMark space={space} size={16} /> : null}
              {t?.due_date ? (
                <Text style={TABULAR} className={`text-[12px] ${t.due_date < today ? "text-high" : "text-ink-3"}`}>
                  {capitalize(relativeDayLabel(t.due_date, today))}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text className="text-ink-3 mb-1.5 mt-5 text-[12px] font-semibold">For how long?</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {lengths.map((m) => {
          const on = m === minutes;
          return (
            <Pressable
              key={m}
              onPress={() => setMinutes(m)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              className={`h-[34px] items-center justify-center rounded-pill border px-3.5 ${on ? "border-accent bg-accent/[0.08]" : "border-line hover:bg-chip"}`}
            >
              <Text style={TABULAR} className={`text-[13px] font-medium ${on ? "text-accent" : "text-ink-2"}`}>
                {formatMinutes(m)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => onStart(pickedTask, minutes)}
        accessibilityRole="button"
        style={pressScale}
        className="bg-accent mt-6 h-[46px] flex-row items-center justify-center gap-2 rounded-[12px]"
      >
        <Play size={16} color={c.onAccent} strokeWidth={2.4} />
        <Text className="text-on-accent text-[15px] font-semibold">Start {formatMinutes(minutes)}</Text>
      </Pressable>
    </View>
  );
}
