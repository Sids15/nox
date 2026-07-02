import { useCreateTask, useDeleteTask, useTasks, useToggleTask } from "@nox/features";
import type { Task } from "@nox/types";
import { dark } from "@nox/ui";
import { dayOfMonth, monthShort, relativeDayLabel, todayKey, weekdayShort } from "@nox/utils";
import { useRouter } from "expo-router";
import { Bell, ChevronDown, ChevronRight } from "lucide-react-native";
import { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileAvatar } from "../../components/profile-avatar";
import { DEFAULT_FILTERS, FilterChips, type TaskFilters } from "../../components/tasks/filter-chips";
import { QuickAddRow } from "../../components/tasks/quick-add-row";
import { SwipeableTaskRow } from "../../components/tasks/swipeable-task-row";
import { TaskRow } from "../../components/tasks/task-row";
import { WeekStrip } from "../../components/tasks/week-strip";

const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** A rounded group card of swipeable task rows, with an optional footer (the quick-add row). */
function GroupCard({
  rows,
  overdue,
  onToggle,
  onDelete,
  onOpen,
  footer,
}: {
  rows: Task[];
  overdue?: boolean;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onOpen: (t: Task) => void;
  footer?: ReactNode;
}) {
  return (
    <View className="border-line bg-surface rounded-card overflow-hidden border">
      {rows.map((t, i) => (
        <View key={t.id}>
          {i > 0 && <View className="bg-line ml-4 h-px" />}
          <SwipeableTaskRow onComplete={() => onToggle(t)} onDelete={() => onDelete(t)}>
            <TaskRow task={t} overdue={overdue} onToggle={() => onToggle(t)} onPress={() => onOpen(t)} />
          </SwipeableTaskRow>
        </View>
      ))}
      {footer && rows.length > 0 && <View className="bg-line ml-4 h-px" />}
      {footer}
    </View>
  );
}

function SectionLabel({ text, count, tone }: { text: string; count?: number; tone?: "overdue" }) {
  return (
    <Text
      className={`mb-2 mt-6 font-mono text-[10px] font-semibold tracking-[1.4px] ${
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
  const today = todayKey();
  const [focus, setFocus] = useState(today);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  const toggleTask = useToggleTask();
  const deleteTask = useDeleteTask();

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

  const submitAdd = () => {
    const title = draft.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    createTask.mutate({
      title,
      notes: null,
      due_date: focus,
      due_time: null,
      reminder_times: [],
      priority: "medium",
      repeat: "none",
      repeat_config: null,
    });
    setDraft("");
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
            <Text className="text-ink-3 font-mono text-[10px] font-semibold tracking-[1.4px]">
              {weekdayShort(focus)} · {monthShort(focus)} {dayOfMonth(focus)}
            </Text>
            <Text className="text-ink mt-1 text-3xl font-bold">{title}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
              <Bell size={17} color={dark.ink2} strokeWidth={1.7} />
            </Pressable>
            <ProfileAvatar />
          </View>
        </View>

        {/* Week strip */}
        <View className="px-screen mt-5">
          <WeekStrip selected={focus} onSelect={setFocus} />
        </View>

        {/* Filters */}
        <View className="px-screen mt-4">
          <FilterChips filters={filters} onChange={setFilters} />
        </View>

        <View className="px-screen">
          {isLoading && tasks.length === 0 ? (
            <View className="mt-16 items-center">
              <ActivityIndicator color={dark.accent} />
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
                  <GroupCard
                    rows={dayTasks}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onOpen={onOpen}
                    footer={
                      <QuickAddRow
                        active={adding}
                        value={draft}
                        onChangeText={setDraft}
                        onActivate={() => setAdding(true)}
                        onSubmit={submitAdd}
                        onCancel={() => {
                          if (!draft.trim()) setAdding(false);
                        }}
                      />
                    }
                  />

                  {upcoming.length > 0 && (
                    <>
                      <Pressable
                        onPress={() => setUpcomingOpen((o) => !o)}
                        className="border-line bg-surface rounded-card mt-3 flex-row items-center justify-between border px-4 py-3"
                      >
                        <Text className="text-ink text-[15px] font-semibold">Upcoming</Text>
                        <View className="flex-row items-center gap-2">
                          <View className="bg-chip rounded-pill px-2 py-0.5">
                            <Text className="text-ink-2 font-mono text-[11px]">{upcoming.length}</Text>
                          </View>
                          {upcomingOpen ? (
                            <ChevronDown size={18} color={dark.ink3} strokeWidth={1.7} />
                          ) : (
                            <ChevronRight size={18} color={dark.ink3} strokeWidth={1.7} />
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
        onPress={() => setAdding(true)}
        accessibilityRole="button"
        accessibilityLabel="Add task"
        className="bg-accent rounded-fab absolute h-[54px] w-[54px] items-center justify-center"
        style={{
          right: 20,
          bottom: 112,
          shadowColor: dark.accent,
          shadowOpacity: 0.4,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Text className="text-[26px] leading-[28px] text-white">+</Text>
      </Pressable>
    </SafeAreaView>
  );
}
