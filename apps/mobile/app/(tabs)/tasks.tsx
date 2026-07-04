import {
  useCreateTask,
  useDeleteTask,
  useEnsureOccurrences,
  useRunCarryover,
  useTasks,
  useThemeColors,
  useToggleTask,
} from "@nox/features";
import type { Task } from "@nox/types";
import { dayOfMonth, monthShort, relativeDayLabel, todayKey, weekdayShort } from "@nox/utils";
import { useRouter } from "expo-router";
import { Bell, ChevronDown, ChevronRight, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileAvatar } from "../../components/profile-avatar";
import { DEFAULT_FILTERS, FilterChips, type TaskFilters } from "../../components/tasks/filter-chips";
import { SwipeableTaskRow } from "../../components/tasks/swipeable-task-row";
import { TaskRow } from "../../components/tasks/task-row";
import { WeekStrip } from "../../components/tasks/week-strip";

const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A rounded group card of swipeable task rows. */
function GroupCard({
  rows,
  overdue,
  onToggle,
  onDelete,
  onOpen,
}: {
  rows: Task[];
  overdue?: boolean;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onOpen: (t: Task) => void;
}) {
  return (
    <View className="border-line bg-surface rounded-card overflow-hidden border">
      {rows.map((t, i) => (
        <View key={t.id}>
          {i > 0 && <View className="bg-line ml-[14px] h-px" />}
          <SwipeableTaskRow
            completed={t.status === "complete"}
            onComplete={() => onToggle(t)}
            onDelete={() => onDelete(t)}
          >
            <TaskRow task={t} overdue={overdue} onToggle={() => onToggle(t)} onPress={() => onOpen(t)} />
          </SwipeableTaskRow>
        </View>
      ))}
    </View>
  );
}

function SectionLabel({ text, count, tone }: { text: string; count?: number; tone?: "overdue" }) {
  return (
    <Text
      className={`mb-2 mt-[18px] pl-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] ${
        tone === "overdue" ? "text-high" : "text-ink-3"
      }`}
    >
      {text}
      {count != null ? ` · ${count}` : ""}
    </Text>
  );
}

export default function TasksScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const today = todayKey();
  const [focus, setFocus] = useState(today);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();
  const ensureOccurrences = useEnsureOccurrences();
  const runCarryover = useRunCarryover();

  // Generate recurring occurrences for the focused day, and roll overdue tasks to today once daily.
  useEffect(() => {
    ensureOccurrences(focus);
  }, [focus, tasks.length, ensureOccurrences]);
  useEffect(() => {
    if (!isLoading) runCarryover();
  }, [isLoading, tasks.length, runCarryover]);

  // Priority + time filters apply to the whole list before grouping.
  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (filters.priority !== "all" && t.priority !== filters.priority) return false;
        if (filters.time === "timed" && t.due_time == null) return false;
        if (filters.time === "allday" && t.due_time != null) return false;
        return true;
      }),
    [tasks, filters.priority, filters.time],
  );

  // Grouped relative to the focused day. Status filter decides which sections show.
  const { overdue, dayTasks, upcoming, completedOnly } = useMemo(() => {
    const done = (t: Task) => t.status === "complete";
    const onDay = (t: Task) => t.due_date === focus || (t.due_date === null && focus === today);

    if (filters.status === "completed") {
      return { overdue: [], dayTasks: [], upcoming: [], completedOnly: filtered.filter(done) };
    }
    const activeOnly = filters.status === "active";
    return {
      overdue: filtered.filter((t) => !done(t) && t.due_date !== null && t.due_date < focus),
      dayTasks: filtered.filter((t) => onDay(t) && (activeOnly ? !done(t) : true)),
      upcoming: filtered.filter((t) => !done(t) && t.due_date !== null && t.due_date > focus),
      completedOnly: [] as Task[],
    };
  }, [filtered, focus, today, filters.status]);

  const onToggle = (t: Task) =>
    toggleTask.mutate({ id: t.id, status: t.status === "complete" ? "pending" : "complete" });
  const onDelete = (t: Task) => deleteTask.mutate(t.id);
  const onOpen = (t: Task) => router.push(`/task/${t.id}`);

  // Create a draft task on the focused day and open its editor to configure it.
  const createAndOpen = () => {
    const id = createTask.create({
      title: "New task",
      notes: null,
      due_date: focus,
      due_time: null,
      reminder_times: [],
      priority: "medium",
      repeat: "none",
      repeat_config: null,
    });
    router.push(`/task/${id}?new=1`);
  };

  const title = focus === today ? "Today" : capitalize(relativeDayLabel(focus, today));

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-screen flex-row items-start justify-between pt-2">
          <View>
            <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">
              {weekdayShort(focus)} · {monthShort(focus)} {dayOfMonth(focus)}
            </Text>
            <Text className="text-ink mt-[3px] text-[30px] font-bold leading-[33px] tracking-[-0.02em]">
              {title}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
              <Bell size={17} color={c.ink2} strokeWidth={1.7} />
            </Pressable>
            <ProfileAvatar />
          </View>
        </View>

        {/* Week strip */}
        <View className="px-screen mt-4">
          <WeekStrip selected={focus} onSelect={setFocus} />
        </View>

        {/* Filters */}
        <View className="px-screen mt-[14px]">
          <FilterChips filters={filters} onChange={setFilters} />
        </View>

        <View className="px-screen">
          {isLoading && tasks.length === 0 ? (
            <View className="mt-16 items-center">
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <>
              {overdue.length > 0 && (
                <>
                  <SectionLabel text="OVERDUE" count={overdue.length} tone="overdue" />
                  <GroupCard rows={overdue} overdue onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} />
                </>
              )}

              {filters.status === "completed" ? (
                <>
                  <SectionLabel text="COMPLETED" count={completedOnly.length} />
                  {completedOnly.length > 0 ? (
                    <GroupCard rows={completedOnly} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} />
                  ) : (
                    <Text className="text-ink-3 mt-2 text-[14px]">Nothing completed yet.</Text>
                  )}
                </>
              ) : (
                <>
                  <SectionLabel text={title.toUpperCase()} count={dayTasks.length} />
                  {dayTasks.length > 0 && (
                    <GroupCard rows={dayTasks} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} />
                  )}
                  <Pressable
                    onPress={createAndOpen}
                    className="flex-row items-center gap-[10px] px-4 py-[10px]"
                  >
                    <Plus size={14} color={c.ink3} strokeWidth={2} />
                    <Text className="text-ink-3 text-[14px] font-medium">Add task</Text>
                  </Pressable>

                  {upcoming.length > 0 && (
                    <>
                      <Pressable
                        onPress={() => setUpcomingOpen((o) => !o)}
                        className="border-line bg-surface rounded-card mt-2 flex-row items-center justify-between border px-[14px] py-[13px]"
                      >
                        <Text className="text-ink-2 text-[14px] font-semibold">Upcoming</Text>
                        <View className="flex-row items-center gap-2">
                          <View className="bg-chip rounded-pill px-[9px] py-[5px]">
                            <Text className="text-ink-3 font-mono text-[11px] font-semibold">{upcoming.length}</Text>
                          </View>
                          {upcomingOpen ? (
                            <ChevronDown size={18} color={c.ink3} strokeWidth={1.7} />
                          ) : (
                            <ChevronRight size={18} color={c.ink3} strokeWidth={1.7} />
                          )}
                        </View>
                      </Pressable>
                      {upcomingOpen && (
                        <View className="mt-2">
                          <GroupCard rows={upcoming} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} />
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB — activates quick-add */}
      <Pressable
        onPress={createAndOpen}
        accessibilityRole="button"
        accessibilityLabel="Add task"
        className="bg-accent rounded-fab absolute h-[54px] w-[54px] items-center justify-center"
        style={{
          right: 20,
          bottom: 112,
          shadowColor: c.accent,
          shadowOpacity: 0.4,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Plus size={22} color={c.onAccent} strokeWidth={2.2} />
      </Pressable>
    </SafeAreaView>
  );
}
