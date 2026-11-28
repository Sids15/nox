import {
  useEnsureOccurrences,
  usePrefs,
  useRunCarryover,
  useTasks,
  useThemeColors,
  useToggleTask,
  useUpdateTask,
} from "@nox/features";
import type { Task } from "@nox/types";
import { addDays, capitalize, dayOfWeek, relativeDayLabel, todayKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { CalendarClock, CalendarDays, ChevronDown, ChevronRight, List, ListChecks, ListFilter, Plus, X } from "lucide-react-native";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ResizablePane } from "../../components/resizable-pane";
import { BriefCard } from "../../components/ai/brief-card";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../components/empty-state";
import { Fab, useHideOnScroll } from "../../components/fab";
import { MenuDivider, MenuLabel, MenuRow, pressScale, TABULAR } from "../../components/menu";
import { Popover } from "../../components/popover";
import { ProfileAvatar } from "../../components/profile-avatar";
import { PlanMenu } from "../../components/plan-menu";
import { PlanWeekSheet } from "../../components/tasks/plan-week-sheet";
import { ListSkeleton } from "../../components/skeleton";
import { NewTaskDialog } from "../../components/tasks/new-task-dialog";
import { TaskCalendar } from "../../components/tasks/task-calendar";
import { SwipeableTaskRow } from "../../components/tasks/swipeable-task-row";
import { dateLabel } from "../../components/tasks/task-properties";
import { TaskEditor } from "../../components/tasks/task-editor";
import { TaskRow } from "../../components/tasks/task-row";
import { WeekStrip } from "../../components/tasks/week-strip";
import { useIsDesktop } from "../../lib/use-responsive";
import { useTaskDelete } from "../../lib/use-task-delete";

const LONG_WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LONG_MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


const byTime = (a: Task, b: Task) => (a.due_time ?? "").localeCompare(b.due_time ?? "") || a.created_at.localeCompare(b.created_at);
const byOrder = (a: Task, b: Task) =>
  a.sort_order - b.sort_order ||
  ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) ||
  a.created_at.localeCompare(b.created_at);

/* ─────────────────────────────── pieces ─────────────────────────────── */

/**
 * The tear-off calendar leaf: a small paper tile with a vermilion month band over the day number set
 * large in the serif. It is the one signature move of the Ink & Paper world (DESIGN.md) and follows
 * the day being viewed.
 */
function CalendarLeaf({ dateKey }: { dateKey: string }) {
  const c = useThemeColors();
  const month = LONG_MONTH[Number(dateKey.slice(5, 7)) - 1]!.slice(0, 3).toUpperCase();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="border-line bg-elev w-[54px] overflow-hidden rounded-[10px] border"
      style={{ shadowColor: "#1B2131", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
    >
      <View className="items-center py-[3px]" style={{ backgroundColor: c.accent }}>
        <Text className="text-on-accent text-[11px] font-bold tracking-[0.08em]">{month}</Text>
      </View>
      <Text style={TABULAR} className="text-ink py-1 text-center font-serif text-[24px] font-bold leading-[32px]">
        {Number(dateKey.slice(8))}
      </Text>
    </View>
  );
}

interface TaskFilters {
  status: "all" | "active" | "completed";
  priority: "all" | "high" | "medium" | "low";
  time: "all" | "timed" | "allday";
}
const DEFAULT_FILTERS: TaskFilters = { status: "all", priority: "all", time: "all" };

/** The filter as one anchored menu of three single-choice groups, rather than three dropdown chips in
 *  a box that each opened another menu. */
function FilterMenu({ filters, onChange }: { filters: TaskFilters; onChange: (f: TaskFilters) => void }) {
  const set = <K extends keyof TaskFilters>(k: K, v: TaskFilters[K]) => onChange({ ...filters, [k]: v });
  return (
    <View className="p-1.5">
      <MenuLabel>Show</MenuLabel>
      <MenuRow label="All tasks" selected={filters.status === "all"} onPress={() => set("status", "all")} />
      <MenuRow label="Open only" selected={filters.status === "active"} onPress={() => set("status", "active")} />
      <MenuRow label="Completed only" selected={filters.status === "completed"} onPress={() => set("status", "completed")} />
      <MenuDivider />
      <MenuLabel>Priority</MenuLabel>
      <MenuRow label="Any priority" selected={filters.priority === "all"} onPress={() => set("priority", "all")} />
      {(["high", "medium", "low"] as const).map((p) => (
        <MenuRow key={p} label={capitalize(p)} selected={filters.priority === p} onPress={() => set("priority", p)} />
      ))}
      <MenuDivider />
      <MenuLabel>Time</MenuLabel>
      <MenuRow label="Any time" selected={filters.time === "all"} onPress={() => set("time", "all")} />
      <MenuRow label="With a time" selected={filters.time === "timed"} onPress={() => set("time", "timed")} />
      <MenuRow label="All-day" selected={filters.time === "allday"} onPress={() => set("time", "allday")} />
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
        <Text className={`text-[14px] font-bold tracking-[-0.01em] ${tone === "overdue" ? "text-high" : "text-ink"}`}>
          {title}
          {count != null ? <Text style={TABULAR} className="text-ink-3 font-semibold">{`  ${count}`}</Text> : null}
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
        className="border-line hover:bg-surface flex-row items-center gap-1.5 rounded-t-[6px] border-b pb-2 pl-1 pt-1"
      >
        <Chevron size={15} color={c.ink3} strokeWidth={2.2} />
        <Text className="text-ink-2 text-[14px] font-bold tracking-[-0.01em]">
          {title}
          <Text style={TABULAR} className="text-ink-3 font-semibold">{`  ${count}`}</Text>
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
  const [planning, setPlanning] = useState(false);
  const filterRef = useRef<View>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeTime, setComposeTime] = useState<string | null>(null);
  const [headerWidth, setHeaderWidth] = useState(0);
  const calendarView = usePrefs((s) => s.calendar.view);
  const setCalendar = usePrefs((s) => s.setCalendar);
  const lastCalendar = useRef<"day" | "week">(calendarView === "week" ? "week" : "day");
  if (calendarView !== "list") lastCalendar.current = calendarView;
  const inCalendar = calendarView !== "list";
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

  const createAndOpen = () => {
    setComposeTime(null);
    setComposing(true);
  };
  const createAt = (date: string, time: string | null) => {
    setFocus(date);
    setComposeTime(time);
    setComposing(true);
  };
  const newTaskDialog = (
    <>
      <PlanWeekSheet visible={planning} onClose={() => setPlanning(false)} />
      <NewTaskDialog visible={composing} initialDate={focus} initialTime={composeTime} onClose={() => setComposing(false)} />
    </>
  );

  const title = focus === today ? "Today" : capitalize(relativeDayLabel(focus, today));
  const selectedTask = selectedId ? tasks.find((t) => t.id === selectedId) : undefined;
  const detailOpen = isDesktop && !!selectedTask;
  const dayEmpty = sections.overdue.length + sections.scheduled.length + sections.anytime.length === 0;

  const rows = (list: Task[], opts: { overdue?: boolean; showDate?: boolean; timeGutter?: boolean } = {}) =>
    list.map((t, i) => (
      <Fragment key={t.id}>
        {i > 0 && <View className="bg-line h-px" style={{ marginLeft: opts.timeGutter ? 101 : 38 }} />}
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

  const dayWord = focus === today ? "today" : dateLabel(focus, today).replace(/^(Tomorrow|Yesterday)$/, (w) => w.toLowerCase());
  const progressText =
    progress.total > 0
      ? progress.done === progress.total
        ? "all done"
        : // Phones have the room for "4/9 done" beside the view switch, not "4 of 9 done".
          isDesktop
          ? `${progress.done} of ${progress.total} done`
          : `${progress.done}/${progress.total} done`
      : null;

  // The header drops its button labels when its own pane is narrow (measured, not assumed).
  const tight = headerWidth > 0 && headerWidth < 560;
  const header = (
    <View className="px-screen pt-2" onLayout={(e) => setHeaderWidth(e.nativeEvent.layout.width)}>
      {/* The calendar leaf (the app's signature: a tear-off date in ink and vermilion) beside the
          title, with one plain line under the title — no label above, no progress ring. */}
      <View className="flex-row items-start justify-between">
        <CalendarLeaf dateKey={focus} />
        <View className="flex-1 pl-3.5 pr-3 pt-0.5">
          <Text numberOfLines={1} className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">
            {title}
          </Text>
          {/* Two runs that wrap as wholes — a narrow pane breaks between them, never inside "1 of 12". */}
          <View className="mt-0.5 flex-row flex-wrap">
            <Text className="text-ink-3 mr-2 text-[14px] font-medium">
              {isDesktop ? LONG_WEEKDAY[dayOfWeek(focus)] : LONG_WEEKDAY[dayOfWeek(focus)]!.slice(0, 3)}
              {progressText ? "  ·" : ""}
            </Text>
            {progressText && (
              <Text style={TABULAR} className="text-ink-3 text-[14px] font-medium">
                {progressText}
              </Text>
            )}
          </View>
        </View>
        <View className="flex-row items-center gap-1.5 pt-1">
          {/* List or calendar */}
          <View className="bg-chip flex-row rounded-[10px] p-0.5" accessibilityRole="tablist">
            {([
              { key: "list", label: "List", Icon: List },
              { key: "calendar", label: "Calendar", Icon: CalendarDays },
            ] as const).map(({ key, label, Icon }) => {
              const on = key === "list" ? !inCalendar : inCalendar;
              return (
                <Pressable
                  key={key}
                  onPress={() => setCalendar({ view: key === "list" ? "list" : lastCalendar.current })}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  className={`h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2 ${on ? "bg-surface" : ""}`}
                  style={on ? { shadowColor: "#1B2131", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : undefined}
                >
                  <Icon size={15} color={on ? c.ink : c.ink3} strokeWidth={2} />
                  {isDesktop && !tight && <Text className={`text-[13px] font-semibold ${on ? "text-ink" : "text-ink-3"}`}>{label}</Text>}
                </Pressable>
              );
            })}
          </View>
          {!inCalendar && (
          <View ref={filterRef} collapsable={false}>
            <Pressable
              onPress={() => setFiltersOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Filters"
              accessibilityState={{ expanded: filtersOpen }}
              style={pressScale}
              className={`h-[34px] w-[34px] items-center justify-center rounded-[10px] ${
                filtersOpen || filtersActive ? "bg-accent/[0.14]" : "hover:bg-chip"
              }`}
            >
              <ListFilter size={17} color={filtersOpen || filtersActive ? c.accent : c.ink2} strokeWidth={2} />
            </Pressable>
          </View>
          )}
          {isDesktop ? (
            <Pressable
              onPress={() => setPlanning(true)}
              accessibilityRole="button"
              accessibilityLabel="Plan my week: fit tasks into your free time"
              style={pressScale}
              className="hover:bg-chip h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-2.5"
            >
              <CalendarClock size={16} color={c.ink2} strokeWidth={2} />
              {!tight && <Text className="text-ink-2 text-[13px] font-semibold">Plan week</Text>}
            </Pressable>
          ) : null}
          {isDesktop ? (
            <Pressable
              onPress={createAndOpen}
              accessibilityRole="button"
              accessibilityLabel="New task"
              style={pressScale}
              className="bg-accent hover:opacity-90 h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-3.5"
            >
              <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
              {/* Beside an open task the pane is narrow: the button keeps its icon and loses its label. */}
              {!tight && <Text className="text-on-accent text-[14px] font-semibold">New task</Text>}
            </Pressable>
          ) : (
            <>
              <PlanMenu />
              <ProfileAvatar />
            </>
          )}
        </View>
      </View>

      <Popover anchorRef={filterRef} open={filtersOpen} onClose={() => setFiltersOpen(false)} width={240} accessibilityLabel="Filters">
        <FilterMenu filters={filters} onChange={setFilters} />
      </Popover>

      {filtersActive && (
        <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
          {filterSummary.map((f) => (
            <View key={f} className="bg-accent/[0.12] rounded-pill px-2.5 py-1">
              <Text className="text-accent text-[12px] font-semibold">{f}</Text>
            </View>
          ))}
          <Pressable
            onPress={() => setFilters(DEFAULT_FILTERS)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            className="hover:bg-chip ml-0.5 h-6 w-6 items-center justify-center rounded-full"
          >
            <X size={13} color={c.ink3} strokeWidth={2.4} />
          </Pressable>
        </View>
      )}

      {!inCalendar && (
      <>
      <View className="mt-5">
        <WeekStrip selected={focus} today={today} onSelect={setFocus} marked={openDays} />
      </View>

      {/* Add — shaped like a task row, so it reads as "the next task goes here". The tip about
          typing dates lives in the dialog it opens, not here too. */}
      <Pressable
        onPress={createAndOpen}
        accessibilityRole="button"
        accessibilityLabel={`Add a task for ${dayWord}`}
        className="hover:bg-surface mt-3 min-h-[48px] flex-row items-center rounded-[10px] pl-1 pr-3"
      >
        <View className="bg-accent/[0.14] h-[21px] w-[21px] items-center justify-center rounded-full">
          <Plus size={13} color={c.accent} strokeWidth={2.6} />
        </View>
        <Text className="text-ink-3 ml-3 text-[15px]">Add a task{focus === today ? "" : ` for ${dayWord}`}</Text>
      </Pressable>
      {focus === today && <BriefCard today={today} />}
      </>
      )}
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
                  <Text className="text-accent text-[13px] font-semibold">Move to today</Text>
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
                  <Text className="text-ink-2 mb-0.5 mt-3.5 pl-1 text-[13px] font-semibold">
                    {dateLabel(day, today)}
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
            ? { paddingHorizontal: 10, paddingTop: 28, maxWidth: 700, width: "100%", alignSelf: "center" }
            : { paddingHorizontal: 10, paddingTop: 28, maxWidth: 760, width: "100%", alignSelf: "center" }
          : null),
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      // The title row stays put while the day scrolls under it.
      stickyHeaderIndices={[0]}
    >
      <View className="bg-bg pb-2">{header}</View>
      {body}
    </ScrollView>
  );

  if (inCalendar) {
    const calendar = (
      <View className="flex-1" style={isDesktop ? { paddingTop: 24 } : undefined}>
        <View style={isDesktop ? { paddingHorizontal: 10 } : undefined}>{header}</View>
        <View className="mt-4 flex-1">
          <TaskCalendar focus={focus} onFocus={setFocus} today={today} onOpenTask={onOpen} onCreateAt={createAt} />
        </View>
      </View>
    );
    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        {detailOpen ? (
          <View className="flex-1 flex-row">
            <View className="border-line flex-1 border-r">{calendar}</View>
            <ResizablePane id="tasks.editor" initial={440} min={340} max={720} edge="left">
              <TaskEditor key={selectedId} id={selectedId!} onClose={() => setSelectedId(null)} />
            </ResizablePane>
          </View>
        ) : (
          calendar
        )}
        {!isDesktop && <Fab onPress={createAndOpen} label="Add task" bottom={112} visible />}
        {newTaskDialog}
      </SafeAreaView>
    );
  }

  // Desktop: master-detail while a task is open — the list on the left, the editor on the right.
  if (detailOpen) {
    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        <View className="flex-1 flex-row">
          {/* The list keeps its room; the task opens in a panel beside it (it used to squeeze the
              list into a narrow column and leave the editor mostly empty). */}
          <View className="border-line min-w-[320px] flex-1 border-r">{list}</View>
          <ResizablePane id="tasks.editor" initial={480} min={340} max={720} edge="left">
            <TaskEditor key={selectedId} id={selectedId!} onClose={() => setSelectedId(null)} />
          </ResizablePane>
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
