import {
  useEnsureOccurrences,
  useRunCarryover,
  useTasks,
  useThemeColors,
  useToggleTask,
  useUpdateTask,
} from "@nox/features";
import type { Task } from "@nox/types";
import { addDays, capitalize, relativeDayLabel, todayKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronRight, ListChecks, Plus, SlidersHorizontal, Sparkles, X } from "lucide-react-native";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { EmptyState } from "../../components/empty-state";
import { Fab, useHideOnScroll } from "../../components/fab";
import { ProfileAvatar } from "../../components/profile-avatar";
import { ListSkeleton } from "../../components/skeleton";
import { DEFAULT_FILTERS, FilterChips, type TaskFilters } from "../../components/tasks/filter-chips";
import { NewTaskDialog } from "../../components/tasks/new-task-dialog";
import { SwipeableTaskRow } from "../../components/tasks/swipeable-task-row";
import { dateLabel } from "../../components/tasks/task-properties";
import { TaskEditor } from "../../components/tasks/task-editor";
import { TaskRow } from "../../components/tasks/task-row";
import { WeekStrip } from "../../components/tasks/week-strip";
import { useIsDesktop } from "../../lib/use-responsive";
import { useTaskDelete } from "../../lib/use-task-delete";

const LONG_WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LONG_MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Saturday, 14 November". */
function longDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return `${LONG_WEEKDAY[new Date(y, m - 1, d).getDay()]}, ${d} ${LONG_MONTH[m - 1]}`;
}

const byTime = (a: Task, b: Task) => (a.due_time ?? "").localeCompare(b.due_time ?? "") || a.created_at.localeCompare(b.created_at);
const byOrder = (a: Task, b: Task) =>
  a.sort_order - b.sort_order ||
  ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) ||
  a.created_at.localeCompare(b.created_at);

/* ─────────────────────────────── pieces ─────────────────────────────── */

/** A small progress ring with "done/total" beside the title — Things' project pie, for the day. */
function DayProgress({ done, total }: { done: number; total: number }) {
  const c = useThemeColors();
  if (total === 0) return null;
  const r = 9;
  const circ = 2 * Math.PI * r;
  const all = done === total;
  return (
    <View className="flex-row items-center gap-1.5" accessibilityLabel={`${done} of ${total} done`}>
      <Svg width={22} height={22} viewBox="0 0 22 22">
        <Circle cx={11} cy={11} r={r} stroke={c.line} strokeWidth={2.5} fill="none" />
        <Circle
          cx={11}
          cy={11}
          r={r}
          stroke={all ? c.success : c.accent}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - done / total)}
          transform="rotate(-90 11 11)"
        />
      </Svg>
      <Text className="text-ink-3 font-mono text-[11.5px] font-semibold">
        {done}/{total}
      </Text>
    </View>
  );
}

/** A section: a quiet header (title · count, optional action on the right) over flat rows. */
function Section({
  title,
  count,
  tone,
  action,
  children,
}: {
  title: string;
  count?: number;
  tone?: "overdue";
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="mt-6">
      <View className="border-line mb-0.5 flex-row items-center justify-between border-b pb-2 pl-1">
        <Text className={`text-[13.5px] font-bold tracking-[-0.01em] ${tone === "overdue" ? "text-high" : "text-ink"}`}>
          {title}
          {count != null ? <Text className="text-ink-3 font-semibold">{`  ${count}`}</Text> : null}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/** A fold-away group at the bottom of the list (Completed, Coming up). */
function Fold({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const c = useThemeColors();
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <View className="mt-6">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${count}`}
        className="border-line flex-row items-center gap-1.5 border-b pb-2 pl-1"
      >
        <Chevron size={15} color={c.ink3} strokeWidth={2.2} />
        <Text className="text-ink-2 text-[13.5px] font-bold tracking-[-0.01em]">
          {title}
          <Text className="text-ink-3 font-semibold">{`  ${count}`}</Text>
        </Text>
      </Pressable>
      {open && children}
    </View>
  );
}

/* ─────────────────────────────── screen ─────────────────────────────── */

/**
 * Tasks — one day at a time, laid out the way the best task apps do it:
 *
 * - A calm header: the day as a title with a progress ring (Things), the full date above it, and
 *   only two controls — New task and a filter button. The week strip moves between days.
 * - An "Add a task" line at the top of the list opens the quick-add dialog, where dates can be typed.
 * - The day splits into what is overdue (with one-tap "Move to today", Todoist's Reschedule),
 *   what is Scheduled at a time (in time order, times down the left edge like an agenda), and what is
 *   for Anytime (Todoist's calendar layout groups Overdue / Scheduled / Unscheduled the same way).
 * - Finished tasks and the next seven days fold away at the bottom (Things' Logbook and Upcoming).
 * - Flat rows on the page — no boxes — with the priority on the checkbox ring.
 */
export default function TasksScreen() {
  const fab = useHideOnScroll();
  const router = useRouter();
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const today = todayKey();
  const [focus, setFocus] = useState(today);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const filtersActive = filters.status !== "all" || filters.priority !== "all" || filters.time !== "all";

  const { data: tasks = [], isLoading, isError, refetch } = useTasks();
  const toggleTask = useToggleTask();
  const updateTask = useUpdateTask();
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

  const sections = useMemo(() => {
    const done = (t: Task) => t.status === "complete";
    const onDay = (t: Task) => t.due_date === focus || (t.due_date === null && focus === today);
    // A repeating template shows only on its anchor day and repeats fresh as occurrences; it never
    // piles up as overdue.
    const isTemplate = (t: Task) => t.repeat !== "none" && t.origin_task_id === null;
    const showOpen = filters.status !== "completed";
    const showDone = filters.status !== "active";

    const day = filtered.filter(onDay);
    const open = showOpen ? day.filter((t) => !done(t)) : [];
    const weekEnd = addDays(focus, 7);
    const upcoming = showOpen
      ? filtered
          .filter((t) => !done(t) && t.due_date !== null && t.due_date > focus && t.due_date <= weekEnd)
          .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || byTime(a, b))
      : [];
    const upcomingByDay: [string, Task[]][] = [];
    for (const t of upcoming) {
      const last = upcomingByDay[upcomingByDay.length - 1];
      if (last && last[0] === t.due_date) last[1].push(t);
      else upcomingByDay.push([t.due_date!, [t]]);
    }

    return {
      overdue:
        showOpen && focus === today
          ? filtered
              .filter((t) => !done(t) && !isTemplate(t) && t.due_date !== null && t.due_date < today)
              .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || byTime(a, b))
          : [],
      scheduled: open.filter((t) => t.due_time !== null).sort(byTime),
      anytime: open.filter((t) => t.due_time === null).sort(byOrder),
      completed: showDone ? day.filter(done).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : [],
      upcoming,
      upcomingByDay,
    };
  }, [filtered, focus, today, filters.status]);

  // Progress for the focused day counts the whole day, not just what the filters let through.
  const progress = useMemo(() => {
    const day = tasks.filter((t) => t.due_date === focus || (t.due_date === null && focus === today));
    return { done: day.filter((t) => t.status === "complete").length, total: day.length };
  }, [tasks, focus, today]);

  const openDays = useMemo(() => {
    const days = new Set<string>();
    for (const t of tasks) if (t.status !== "complete" && t.due_date !== null) days.add(t.due_date);
    return days;
  }, [tasks]);

  const onToggle = (t: Task) => toggleTask.mutate({ id: t.id, status: t.status === "complete" ? "pending" : "complete" });
  const onDelete = (t: Task) => requestDelete(t);
  const onOpen = (t: Task) => {
    if (isDesktop) setSelectedId(t.id);
    else router.push(`/task/${t.id}`);
  };
  const moveOverdueToToday = () => {
    for (const t of sections.overdue) updateTask.mutate({ id: t.id, patch: { due_date: today } });
  };

  const createAndOpen = () => setComposing(true);
  const newTaskDialog = <NewTaskDialog visible={composing} initialDate={focus} onClose={() => setComposing(false)} />;

  const title = focus === today ? "Today" : capitalize(relativeDayLabel(focus, today));
  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) : undefined;
  const detailOpen = isDesktop && !!selectedTask;
  const dayEmpty = sections.overdue.length + sections.scheduled.length + sections.anytime.length === 0;

  const rows = (list: Task[], opts: { overdue?: boolean; showDate?: boolean; timeGutter?: boolean } = {}) =>
    list.map((t, i) => (
      <Fragment key={t.id}>
        {i > 0 && <View className="bg-line h-px" style={{ marginLeft: opts.timeGutter ? 97 : 38 }} />}
        <SwipeableTaskRow completed={t.status === "complete"} onComplete={() => onToggle(t)} onDelete={() => onDelete(t)}>
          <TaskRow
            task={t}
            overdue={opts.overdue}
            showDate={opts.showDate}
            timeGutter={opts.timeGutter}
            selected={t.id === selectedId}
            onToggle={() => onToggle(t)}
            onPress={() => onOpen(t)}
          />
        </SwipeableTaskRow>
      </Fragment>
    ));

  const filterSummary = [
    filters.status !== "all" && (filters.status === "active" ? "Open only" : "Completed only"),
    filters.priority !== "all" && `${capitalize(filters.priority)} priority`,
    filters.time !== "all" && (filters.time === "timed" ? "With a time" : "All-day"),
  ].filter(Boolean) as string[];

  const header = (
    <View className="px-screen pt-2">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">
            {longDate(focus).toUpperCase()}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-3">
            <Text className="text-ink text-[30px] font-bold leading-[34px] tracking-[-0.02em]">{title}</Text>
            <DayProgress done={progress.done} total={progress.total} />
          </View>
        </View>
        <View className="flex-row items-center gap-2 pt-1">
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            accessibilityLabel="Filters"
            accessibilityState={{ expanded: filtersOpen }}
            className={`rounded-pill h-[34px] w-[34px] items-center justify-center ${filtersOpen || filtersActive ? "bg-accent-soft" : "bg-chip hover:bg-elev"}`}
          >
            <SlidersHorizontal size={15} color={filtersOpen || filtersActive ? c.accent : c.ink2} strokeWidth={1.9} />
          </Pressable>
          {isDesktop ? (
            <Pressable
              onPress={createAndOpen}
              accessibilityRole="button"
              accessibilityLabel="New task"
              className="bg-accent hover:opacity-90 h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-3.5"
            >
              <Plus size={14} color={c.onAccent} strokeWidth={2.4} />
              <Text className="text-on-accent text-[13px] font-semibold">New task</Text>
            </Pressable>
          ) : (
            <ProfileAvatar />
          )}
        </View>
      </View>

      <View className="mt-5">
        <WeekStrip selected={focus} today={today} onSelect={setFocus} marked={openDays} />
      </View>

      {filtersOpen && (
        <View className="border-line bg-surface mt-4 rounded-[12px] border p-3">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-ink-3 font-mono text-[10px] font-semibold tracking-[0.14em]">FILTER</Text>
            {filtersActive && (
              <Pressable onPress={() => setFilters(DEFAULT_FILTERS)} hitSlop={6}>
                <Text className="text-accent text-[12px] font-semibold">Reset</Text>
              </Pressable>
            )}
          </View>
          <FilterChips filters={filters} onChange={setFilters} />
        </View>
      )}
      {!filtersOpen && filtersActive && (
        <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
          {filterSummary.map((f) => (
            <View key={f} className="bg-accent-soft rounded-pill px-2.5 py-1">
              <Text className="text-accent text-[11.5px] font-semibold">{f}</Text>
            </View>
          ))}
          <Pressable onPress={() => setFilters(DEFAULT_FILTERS)} hitSlop={6} accessibilityLabel="Clear filters" className="ml-0.5">
            <X size={14} color={c.ink3} strokeWidth={2.2} />
          </Pressable>
        </View>
      )}

      {/* Quick add — opens the dialog, where "tomorrow 6pm" style dates are understood. */}
      <Pressable
        onPress={createAndOpen}
        accessibilityRole="button"
        accessibilityLabel={`Add a task to ${title}`}
        className="border-line hover:bg-surface mt-4 flex-row items-center gap-3 rounded-[12px] border border-dashed px-3.5 py-3"
      >
        <View className="border-accent h-[21px] w-[21px] items-center justify-center rounded-full border-[1.5px] border-dashed">
          <Plus size={12} color={c.accent} strokeWidth={2.6} />
        </View>
        <Text className="text-ink-3 flex-1 text-[14.5px]">
          Add a task{focus === today ? "" : ` for ${dateLabel(focus, today).replace(/^(Tomorrow|Yesterday)$/, (w) => w.toLowerCase())}`}
        </Text>
        <View className="flex-row items-center gap-1">
          <Sparkles size={11} color={c.ink3} strokeWidth={2} />
          <Text className="text-ink-3 font-mono text-[10.5px]">try “tomorrow 6pm”</Text>
        </View>
      </Pressable>
    </View>
  );

  const body = (
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
        <View className="mt-6">
          <ListSkeleton />
        </View>
      ) : (
        <>
          {sections.overdue.length > 0 && (
            <Section
              title="Overdue"
              count={sections.overdue.length}
              tone="overdue"
              action={
                <Pressable onPress={moveOverdueToToday} hitSlop={6} accessibilityRole="button" className="hover:bg-chip rounded-[7px] px-2 py-1">
                  <Text className="text-accent text-[12.5px] font-semibold">Move to today</Text>
                </Pressable>
              }
            >
              {rows(sections.overdue, { overdue: true })}
            </Section>
          )}

          {sections.scheduled.length > 0 && (
            <Section title="Scheduled" count={sections.scheduled.length}>
              {rows(sections.scheduled, { timeGutter: true })}
            </Section>
          )}

          {sections.anytime.length > 0 && (
            <Section title={sections.scheduled.length > 0 ? "Anytime" : title} count={sections.anytime.length}>
              {rows(sections.anytime)}
            </Section>
          )}

          {dayEmpty && filters.status !== "completed" && (
            <View className="items-center py-10">
              <Text className="text-ink text-[15px] font-semibold">
                {sections.completed.length > 0 ? "All done for the day" : `Nothing planned for ${focus === today ? "today" : title}`}
              </Text>
              <Text className="text-ink-3 mt-1 text-center text-[13px]">
                {sections.completed.length > 0
                  ? "Everything on the list is checked off."
                  : filtersActive
                    ? "No tasks match these filters."
                    : "Add a task above, or pick another day."}
              </Text>
            </View>
          )}

          {sections.completed.length > 0 && (
            <Fold title="Completed" count={sections.completed.length} open={doneOpen || filters.status === "completed"} onToggle={() => setDoneOpen((v) => !v)}>
              {rows(sections.completed)}
            </Fold>
          )}

          {sections.upcoming.length > 0 && (
            <Fold title="Coming up · next 7 days" count={sections.upcoming.length} open={upcomingOpen} onToggle={() => setUpcomingOpen((v) => !v)}>
              {sections.upcomingByDay.map(([day, list]) => (
                <View key={day}>
                  <Text className="text-ink-3 mb-0.5 mt-3.5 pl-1 font-mono text-[10.5px] font-semibold tracking-[0.1em]">
                    {dateLabel(day, today).toUpperCase()}
                  </Text>
                  {rows(list)}
                </View>
              ))}
            </Fold>
          )}
        </>
      )}
    </View>
  );

  const list = (
    <ScrollView
      onScroll={fab.onScroll}
      scrollEventThrottle={16}
      className="flex-1"
      contentContainerStyle={{
        paddingBottom: 150,
        ...(isDesktop
          ? detailOpen
            ? { paddingHorizontal: 4, paddingTop: 24 }
            : { paddingHorizontal: 10, paddingTop: 28, maxWidth: 760, width: "100%", alignSelf: "center" }
          : null),
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {header}
      {body}
    </ScrollView>
  );

  // Desktop: master-detail while a task is open — the list on the left, the editor on the right.
  if (detailOpen) {
    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        <View className="flex-1 flex-row">
          <View className="border-line w-[420px] border-r">{list}</View>
          <View className="flex-1">
            <TaskEditor key={selectedId} id={selectedId!} onClose={() => setSelectedId(null)} />
          </View>
        </View>
        {newTaskDialog}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      {list}
      {!isDesktop && <Fab onPress={createAndOpen} label="Add task" bottom={112} visible={fab.visible} />}
      {newTaskDialog}
    </SafeAreaView>
  );
}
