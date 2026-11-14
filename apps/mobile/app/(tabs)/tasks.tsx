import {
  useEnsureOccurrences,
  useRunCarryover,
  useTasks,
  useThemeColors,
  useToggleTask,
} from "@nox/features";
import type { Task } from "@nox/types";
import { capitalize, dayOfMonth, monthShort, relativeDayLabel, todayKey, weekdayShort } from "@nox/utils";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronRight, ListChecks, Plus, SlidersHorizontal } from "lucide-react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fab, useHideOnScroll } from "../../components/fab";
import { DesktopHeader } from "../../components/desktop-header";
import { EmptyState } from "../../components/empty-state";
import { ListSkeleton } from "../../components/skeleton";
import { ProfileAvatar } from "../../components/profile-avatar";
import { useIsDesktop } from "../../lib/use-responsive";
import { useTaskDelete } from "../../lib/use-task-delete";
import { DEFAULT_FILTERS, FilterChips, type TaskFilters } from "../../components/tasks/filter-chips";
import { SwipeableTaskRow } from "../../components/tasks/swipeable-task-row";
import { NewTaskDialog } from "../../components/tasks/new-task-dialog";
import { TaskEditor } from "../../components/tasks/task-editor";
import { TaskRow } from "../../components/tasks/task-row";
import { WeekStrip } from "../../components/tasks/week-strip";

/** A rounded group card of swipeable task rows. */
function GroupCard({
  rows,
  overdue,
  onToggle,
  onDelete,
  onOpen,
  selectedId,
}: {
  rows: Task[];
  overdue?: boolean;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onOpen: (t: Task) => void;
  /** Desktop master-detail: which row is open in the editor pane (null on mobile). */
  selectedId?: string | null;
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
            <TaskRow task={t} overdue={overdue} selected={t.id === selectedId} onToggle={() => onToggle(t)} onPress={() => onOpen(t)} />
          </SwipeableTaskRow>
        </View>
      ))}
    </View>
  );
}

/** A collapsed-by-default group below the day's list (Done, Upcoming): a header row with a count
 *  that expands to show its rows. */
function CollapsibleGroup({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const c = useThemeColors();
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="border-line bg-surface rounded-card hover:bg-elev mt-2 flex-row items-center justify-between border px-[14px] py-[13px]"
      >
        <Text className="text-ink-2 text-[14px] font-semibold">{label}</Text>
        <View className="flex-row items-center gap-2">
          <View className="bg-chip rounded-pill px-[9px] py-[5px]">
            <Text className="text-ink-3 font-mono text-[11px] font-semibold">{count}</Text>
          </View>
          <Chevron size={18} color={c.ink3} strokeWidth={1.7} />
        </View>
      </Pressable>
      {open && <View className="mt-2">{children}</View>}
    </>
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
  const fab = useHideOnScroll();
  const router = useRouter();
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const today = todayKey();
  const [focus, setFocus] = useState(today);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  // Desktop master-detail: the task currently open in the right-hand editor pane.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const filtersActive = filters.status !== "all" || filters.priority !== "all" || filters.time !== "all";

  const { data: tasks = [], isLoading, isError, refetch } = useTasks();
  const toggleTask = useToggleTask();
  const requestDelete = useTaskDelete();
  const ensureOccurrences = useEnsureOccurrences();
  const runCarryover = useRunCarryover();

  // Generate recurring occurrences for the focused day (today or later only — never backfill past
  // days, which would create permanently-overdue phantom rows), and roll overdue tasks to today.
  useEffect(() => {
    if (focus >= today) ensureOccurrences(focus);
  }, [focus, today, tasks.length, ensureOccurrences]);
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
    // A recurring template (repeat set, not itself an occurrence) shows only on its anchor day and
    // repeats fresh as occurrences — it must never pile up as overdue.
    const isTemplate = (t: Task) => t.repeat !== "none" && t.origin_task_id === null;

    if (filters.status === "completed") {
      return { overdue: [], dayTasks: [], upcoming: [], completedOnly: filtered.filter(done) };
    }
    const activeOnly = filters.status === "active";
    return {
      // Overdue means overdue NOW — due before today — and it is surfaced on today's view, where it
      // can be acted on. Measured against the focused day instead, browsing ahead to Saturday listed
      // every open task between now and then (even ones due today) as overdue, in coral.
      overdue:
        focus === today
          ? filtered.filter((t) => !done(t) && !isTemplate(t) && t.due_date !== null && t.due_date < today)
          : [],
      dayTasks: filtered.filter((t) => onDay(t) && (activeOnly ? !done(t) : true)),
      upcoming: filtered.filter((t) => !done(t) && t.due_date !== null && t.due_date > focus),
      completedOnly: [] as Task[],
    };
  }, [filtered, focus, today, filters.status]);

  // The day's list leads with what is still open; finished tasks drop into a "Done" group below
  // rather than sitting struck-through between the things you still have to do.
  const dayOpen = useMemo(() => dayTasks.filter((t) => t.status !== "complete"), [dayTasks]);
  const dayDone = useMemo(() => dayTasks.filter((t) => t.status === "complete"), [dayTasks]);
  const dayTotal = dayOpen.length + dayDone.length;

  // Days with something still open get a dot in the week strip.
  const openDays = useMemo(() => {
    const days = new Set<string>();
    for (const t of tasks) if (t.status !== "complete" && t.due_date !== null) days.add(t.due_date);
    return days;
  }, [tasks]);

  const onToggle = (t: Task) =>
    toggleTask.mutate({ id: t.id, status: t.status === "complete" ? "pending" : "complete" });
  // Repeating tasks ask "this day only / every day" first; one-off tasks delete straight away.
  const onDelete = (t: Task) => requestDelete(t);
  // Desktop: open in the editor pane (no navigation). Mobile: push the standalone route.
  const onOpen = (t: Task) => {
    if (isDesktop) {
      setSelectedId(t.id);
    } else {
      router.push(`/task/${t.id}`);
    }
  };

  // Create a draft task on the focused day and open its editor to configure it.
  // New tasks are composed in a dialog over the list (a bottom sheet on phones) — see NewTaskDialog.
  const createAndOpen = () => setComposing(true);
  const newTaskDialog = (
    <NewTaskDialog visible={composing} initialDate={focus} onClose={() => setComposing(false)} />
  );

  const title = focus === today ? "Today" : capitalize(relativeDayLabel(focus, today));
  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) : undefined;
  // Desktop splits only while a task is open; otherwise the list gets a centred, readable column
  // instead of a 400px strip beside an empty "No task selected" pane.
  const detailOpen = isDesktop && !!selectedTask;

  const list = (
      <ScrollView
        onScroll={fab.onScroll}
        scrollEventThrottle={16}
       
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 150,
          ...(isDesktop
            ? detailOpen
              ? { paddingHorizontal: 12, paddingTop: 24 }
              : { paddingHorizontal: 10, paddingTop: 28, maxWidth: 760, width: "100%", alignSelf: "center" }
            : null),
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Header — desktop: 26px title + "New task" pill; mobile: 30px title + filter toggle */}
        {isDesktop ? (
          <DesktopHeader
            eyebrow={`${weekdayShort(focus)} · ${monthShort(focus)} ${dayOfMonth(focus)}`}
            title={title}
            actionLabel="New task"
            onAction={createAndOpen}
          />
        ) : (
          <View className="px-screen flex-row items-start justify-between pt-2">
            <View>
              <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">
                {weekdayShort(focus)} · {monthShort(focus)} {dayOfMonth(focus)}
              </Text>
              <Text className="text-ink mt-2 text-[30px] font-bold leading-[33px] tracking-[-0.02em]">
                {title}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setFiltersOpen((v) => !v)}
                accessibilityLabel="Toggle filters"
                className={`rounded-pill h-[34px] w-[34px] items-center justify-center ${filtersOpen || filtersActive ? "bg-accent-soft" : "bg-chip"}`}
              >
                <SlidersHorizontal size={16} color={filtersOpen || filtersActive ? c.accent : c.ink2} strokeWidth={1.8} />
              </Pressable>
              <ProfileAvatar />
            </View>
          </View>
        )}

        {/* Week strip */}
        <View className="px-screen mt-5">
          <WeekStrip selected={focus} today={today} onSelect={setFocus} marked={openDays} />
        </View>

        {/* Day progress — how much of the focused day is done. Hidden for an empty day and for the
            "Active" filter, which drops finished tasks from the count it would be measured against. */}
        {filters.status === "all" && dayTotal > 0 && (
          <View className="px-screen mt-4 flex-row items-center gap-3">
            <View className="bg-chip h-[5px] flex-1 overflow-hidden rounded-full">
              <View
                className={`h-full rounded-full ${dayDone.length === dayTotal ? "bg-success" : "bg-accent"}`}
                style={{ width: `${Math.round((dayDone.length / dayTotal) * 100)}%` }}
              />
            </View>
            <Text className="text-ink-3 font-mono text-[10.5px] font-medium">
              {dayDone.length === dayTotal ? "all done" : `${dayDone.length} of ${dayTotal} done`}
            </Text>
          </View>
        )}

        {/* Filters (always on desktop; collapsed behind the header toggle on mobile) */}
        {(isDesktop || filtersOpen) && (
          <View className="px-screen mt-3.5">
            <FilterChips filters={filters} onChange={setFilters} />
          </View>
        )}

        <View className="px-screen">
          {isError && tasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Couldn't load your tasks"
              subtitle="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          ) : isLoading && tasks.length === 0 ? (
            <View className="mt-2">
              <ListSkeleton />
            </View>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Plan your first task"
              subtitle="Add what's on your plate — set a time, a reminder, or make it repeat."
              actionLabel="Add a task"
              onAction={createAndOpen}
            />
          ) : (
            <>
              {filters.status === "completed" ? (
                <>
                  <SectionLabel text="COMPLETED" count={completedOnly.length} />
                  {completedOnly.length > 0 ? (
                    <GroupCard rows={completedOnly} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} selectedId={selectedId} />
                  ) : (
                    <Text className="text-ink-3 mt-2 text-[14px]">Nothing completed yet.</Text>
                  )}
                </>
              ) : (
                <>
                  <SectionLabel text={title.toUpperCase()} count={dayOpen.length} />
                  {dayOpen.length > 0 && (
                    <GroupCard rows={dayOpen} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} selectedId={selectedId} />
                  )}
                  <Pressable
                    onPress={createAndOpen}
                    className="flex-row items-center gap-[10px] px-4 py-[10px]"
                  >
                    <Plus size={14} color={c.ink3} strokeWidth={2} />
                    <Text className="text-ink-3 text-[14px] font-medium">Add task</Text>
                  </Pressable>

                  {overdue.length > 0 && (
                    <View className="mt-2">
                      <SectionLabel text="OVERDUE" count={overdue.length} tone="overdue" />
                      <GroupCard rows={overdue} overdue onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} selectedId={selectedId} />
                    </View>
                  )}

                  {dayDone.length > 0 && (
                    <CollapsibleGroup label="Done" count={dayDone.length} open={doneOpen} onToggle={() => setDoneOpen((o) => !o)}>
                      <GroupCard rows={dayDone} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} selectedId={selectedId} />
                    </CollapsibleGroup>
                  )}

                  {upcoming.length > 0 && (
                    <CollapsibleGroup label="Upcoming" count={upcoming.length} open={upcomingOpen} onToggle={() => setUpcomingOpen((o) => !o)}>
                      <GroupCard rows={upcoming} onToggle={onToggle} onDelete={onDelete} onOpen={onOpen} selectedId={selectedId} />
                    </CollapsibleGroup>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
  );

  // Desktop: master-detail while a task is open — the list on the left, the editor on the right.
  if (detailOpen) {
    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        <View className="flex-1 flex-row">
          <View className="border-line w-[400px] border-r">{list}</View>
          <View className="flex-1">
            <TaskEditor key={selectedId} id={selectedId!} onClose={() => setSelectedId(null)} />
          </View>
        </View>
        {newTaskDialog}
      </SafeAreaView>
    );
  }

  // Desktop with nothing open: the list alone, full width.
  if (isDesktop) {
    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        {list}
        {newTaskDialog}
      </SafeAreaView>
    );
  }

  // Mobile: single-column list; a task opens the standalone /task/[id] route.
  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      {list}

      {/* FAB */}
      <Fab onPress={createAndOpen} label="Add task" bottom={112} visible={fab.visible} />
      {newTaskDialog}
    </SafeAreaView>
  );
}
