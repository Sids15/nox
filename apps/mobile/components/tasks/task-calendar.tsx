import { AiRepository } from "@nox/api";
import {
  autoSchedule,
  checkPlan,
  minutesToTime,
  tasksOnDay,
  timeToMinutes,
  usePrefs,
  useSkippedOccurrences,
  useTasks,
  useThemeColors,
  useToggleTask,
  useUpdateTask,
  type CalendarPrefs,
  type PlacedTask,
  type PlannedTask,
  useSpaces,
} from "@nox/features";
import type { Task } from "@nox/types";
import { addDays, dayOfMonth, dayOfWeek, formatTime12, monthShort, weekdayShort } from "@nox/utils";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Repeat, Settings2, Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, type GestureResponderEvent } from "react-native";
import { useAiCall, useAiEnabled } from "../../lib/use-ai";
import { AiAction, AiPanel } from "../ai/ai-ui";
import { useIsDesktop } from "../../lib/use-responsive";
import { MenuDivider, MenuLabel, pressScale, TABULAR } from "../menu";
import { Popover } from "../popover";
import { anchorOf, durationLabel, rebaseReminders } from "./task-properties";
import { withAlpha } from "../../lib/color";
import { SpaceMark } from "../brain/space-mark";

/** Minutes a task covers when it has no duration set. */
const BLOCK = 30;
const lengthOf = (t: Task) => t.duration_minutes || BLOCK;
/** Drags snap to this many minutes. */
const SNAP = 15;
const GUTTER = 52;

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const hourLabel = (h: number) => (h === 0 || h === 24 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`);
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const measure = (v: View | null) =>
  new Promise<Rect | null>((resolve) => {
    if (!v) return resolve(null);
    v.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
const inside = (r: Rect | null, x: number, y: number) => !!r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** Side-by-side lanes for tasks whose blocks overlap. */
export function layoutDay(items: PlannedTask[]): { p: PlannedTask; start: number; lane: number; lanes: number }[] {
  const timed = items
    .filter((p) => p.task.due_time)
    .map((p) => ({ p, start: timeToMinutes(p.task.due_time!) }))
    .sort((a, b) => a.start - b.start);
  const out: { p: PlannedTask; start: number; lane: number; lanes: number }[] = [];
  let cluster: typeof out = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];
  const flush = () => {
    const n = laneEnds.length;
    for (const c of cluster) c.lanes = n;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const t of timed) {
    if (t.start >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((end) => end <= t.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = t.start + lengthOf(t.p.task);
    clusterEnd = Math.max(clusterEnd, t.start + lengthOf(t.p.task));
    cluster.push({ p: t.p, start: t.start, lane, lanes: 0 });
  }
  if (cluster.length) flush();
  return out;
}

interface DragState {
  task: Task;
  /** Where it would land right now, for the ghost's label; null over nowhere useful. */
  target: { day: string; time: string | null } | null;
  x: number;
  y: number;
}

/**
 * The Tasks calendar: a day or week of tasks on an hour grid, for planning.
 *
 * - Timed tasks sit at their time; untimed ones wait in the Anytime row at the top.
 * - Drag a task to change its time (snaps to 15 minutes) or, in the week, its day. Drag it into the
 *   Anytime row to unschedule it; drag from the row onto the grid to schedule it. Reminders keep their
 *   distance from the task when it moves.
 * - Click an empty slot to add a task there; click a task to open it; tick it off in place.
 * - Repeating tasks show on every day they'll happen (faded until their day's copy exists).
 * - Settings (the gear) choose the hours shown, the first day of the week, weekends, completed tasks
 *   and row height; they're remembered.
 */
export function TaskCalendar({
  focus,
  onFocus,
  today,
  onOpenTask,
  onCreateAt,
}: {
  focus: string;
  onFocus: (d: string) => void;
  today: string;
  onOpenTask: (t: Task) => void;
  onCreateAt: (date: string, time: string | null) => void;
}) {
  const { data: spaces = [] } = useSpaces();
  /** The space a task belongs to, shown on its block: "from this space". */
  const spaceTag = (task: { space_id?: string | null }, withName: boolean) => {
    const sp = task.space_id ? spaces.find((x) => x.id === task.space_id) : undefined;
    if (!sp) return null;
    return (
      <View className="flex-shrink-0 flex-row items-center gap-1" accessibilityLabel={`From ${sp.name}`}>
        <SpaceMark space={sp} size={14} />
        {withName ? (
          <Text numberOfLines={1} className="text-ink-3 max-w-[140px] text-[11px] font-medium">
            {sp.name}
          </Text>
        ) : null}
      </View>
    );
  };
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const prefs = usePrefs((s) => s.calendar);
  const setPrefs = usePrefs((s) => s.setCalendar);
  const { data: tasks = [] } = useTasks();
  const { data: skipped } = useSkippedOccurrences();
  const updateTask = useUpdateTask();
  const toggleTask = useToggleTask();
  const mode: "day" | "week" = prefs.view === "week" ? "week" : "day";
  const ROW = prefs.density === "compact" ? 42 : 56;

  // The days on screen. A phone's "week" is three days — seven columns don't fit a phone.
  const days = useMemo(() => {
    if (mode === "day") return [focus];
    if (!isDesktop) return [focus, addDays(focus, 1), addDays(focus, 2)];
    const back = (dayOfWeek(focus) - prefs.weekStartsOn + 7) % 7;
    const start = addDays(focus, -back);
    const all = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return prefs.showWeekends ? all : all.filter((d) => dayOfWeek(d) !== 0 && dayOfWeek(d) !== 6);
  }, [mode, focus, isDesktop, prefs.weekStartsOn, prefs.showWeekends]);
  const step = mode === "day" ? 1 : isDesktop ? 7 : 3;

  const byDay = useMemo(() => {
    const m = new Map<string, PlannedTask[]>();
    for (const d of days)
      m.set(
        d,
        tasksOnDay(tasks, d, today, skipped).filter((p) => prefs.showCompleted || p.task.status !== "complete"),
      );
    return m;
  }, [days, tasks, today, skipped, prefs.showCompleted]);

  // Hours drawn: the chosen range, stretched to include any task outside it.
  const [startHour, endHour] = useMemo(() => {
    let s = prefs.startHour;
    let e = prefs.endHour;
    for (const list of byDay.values())
      for (const p of list)
        if (p.task.due_time) {
          const m = timeToMinutes(p.task.due_time);
          s = Math.min(s, Math.floor(m / 60));
          e = Math.max(e, Math.min(24, Math.ceil((m + lengthOf(p.task)) / 60)));
        }
    return [s, Math.max(e, s + 1)];
  }, [byDay, prefs.startHour, prefs.endHour]);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const yOf = (min: number) => ((min - startHour * 60) / 60) * ROW;

  // Scroll to now (or the start of the day) when the view opens.
  const scroller = useRef<ScrollView>(null);
  useEffect(() => {
    const target = days.includes(today) ? Math.max(0, yOf(nowMinutes()) - ROW * 2) : 0;
    const t = setTimeout(() => scroller.current?.scrollTo({ y: target, animated: false }), 50);
    return () => clearTimeout(t);
  }, [days.join(","), ROW]); // eslint-disable-line react-hooks/exhaustive-deps

  // The red now-line moves with the clock.
  const [now, setNow] = useState(nowMinutes());
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Drag ────────────────────────────────────────────────────────────────────────────────────────
  const rootRef = useRef<View>(null);
  const gridRef = useRef<View>(null);
  const trayRef = useRef<View>(null);
  const geom = useRef<{ root: Rect | null; grid: Rect | null; tray: Rect | null }>({ root: null, grid: null, tray: null });
  const gesture = useRef<{ task: Task; startX: number; startY: number; fromMin: number | null; moved: boolean } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  /** A block being stretched by its bottom edge: the task and its length so far (minutes). */
  const [resize, setResize] = useState<{ id: string; minutes: number } | null>(null);
  const resizeG = useRef<{ task: Task; y0: number; from: number; now: number } | null>(null);
  const resizeHandlers = (task: Task) => ({
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      resizeG.current = { task, y0: e.nativeEvent.pageY, from: lengthOf(task), now: lengthOf(task) };
      setResize({ id: task.id, minutes: lengthOf(task) });
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = resizeG.current;
      if (!g) return;
      const raw = g.from + ((e.nativeEvent.pageY - g.y0) / ROW) * 60;
      g.now = Math.max(SNAP, Math.min(12 * 60, Math.round(raw / SNAP) * SNAP));
      setResize({ id: g.task.id, minutes: g.now });
    },
    onResponderRelease: () => {
      const g = resizeG.current;
      resizeG.current = null;
      setResize(null);
      if (g && g.now !== lengthOf(g.task)) updateTask.mutate({ id: g.task.id, patch: { duration_minutes: g.now } });
    },
    onResponderTerminate: () => {
      resizeG.current = null;
      setResize(null);
    },
  });
  /** The day view's Anytime row, expanded to show every task. */
  const [trayOpen, setTrayOpen] = useState(false);

  const targetAt = (g0: NonNullable<typeof gesture.current>, x: number, y: number): DragState["target"] => {
    const g = geom.current;
    const colOf = (r: Rect) => days[Math.max(0, Math.min(days.length - 1, Math.floor(((x - r.x) / r.width) * days.length)))]!;
    if (inside(g.tray, x, y)) return { day: colOf(g.tray!), time: null };
    if (g.grid && x >= g.grid.x && x <= g.grid.x + g.grid.width) {
      // A block keeps the point you grabbed it by; a chip from the tray lands where the pointer is.
      const min =
        g0.fromMin !== null ? g0.fromMin + ((y - g0.startY) / ROW) * 60 : startHour * 60 + ((y - g.grid.y) / ROW) * 60 - BLOCK / 2;
      const snapped = Math.round(min / SNAP) * SNAP;
      const clamped = Math.max(startHour * 60, Math.min(endHour * 60 - SNAP, snapped));
      return { day: colOf(g.grid), time: minutesToTime(clamped) };
    }
    return null;
  };

  const drop = (task: Task, target: NonNullable<DragState["target"]>) => {
    const sameDay = target.day === task.due_date;
    const sameTime = (target.time ?? null) === (task.due_time?.slice(0, 5) ?? null);
    if (sameDay && sameTime) return;
    updateTask.mutate({
      id: task.id,
      patch: {
        due_date: target.day,
        due_time: target.time,
        reminder_times: rebaseReminders(task.reminder_times, anchorOf(task.due_date, task.due_time), anchorOf(target.day, target.time)),
      },
    });
  };

  /** Responder handlers that make a task tappable and draggable. Projected repeats are tap-only. */
  const handlers = (p: PlannedTask, fromMin: number | null) => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => !!gesture.current,
    onResponderTerminationRequest: () => !gesture.current?.moved,
    onResponderGrant: (e: GestureResponderEvent) => {
      gesture.current = { task: p.task, startX: e.nativeEvent.pageX, startY: e.nativeEvent.pageY, fromMin, moved: false };
      if (p.projected) return;
      void Promise.all([measure(rootRef.current), measure(gridRef.current), measure(trayRef.current)]).then(([root, grid, tray]) => {
        geom.current = { root, grid, tray };
      });
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = gesture.current;
      if (!g || p.projected) return;
      const { pageX: x, pageY: y } = e.nativeEvent;
      if (!g.moved && Math.hypot(x - g.startX, y - g.startY) < 6) return;
      g.moved = true;
      setDrag({ task: g.task, target: targetAt(g, x, y), x, y });
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const g = gesture.current;
      gesture.current = null;
      setDrag(null);
      if (!g) return;
      if (!g.moved) {
        onOpenTask(p.task);
        return;
      }
      const t = targetAt(g, e.nativeEvent.pageX, e.nativeEvent.pageY);
      if (t) drop(g.task, t);
    },
    onResponderTerminate: () => {
      gesture.current = null;
      setDrag(null);
    },
  });

  // ── Pieces ──────────────────────────────────────────────────────────────────────────────────────
  const priorityRing: Record<Task["priority"], string> = { low: c.ink3, medium: c.medium, high: c.high };

  const checkbox = (p: PlannedTask, size: number) => {
    const done = p.task.status === "complete";
    return (
      <Pressable
        onPress={() => !p.projected && toggleTask.mutate({ id: p.task.id, status: done ? "pending" : "complete" })}
        disabled={p.projected}
        hitSlop={6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: p.projected }}
        accessibilityLabel={`Complete ${p.task.title}`}
        style={{
          width: size,
          height: size,
          borderRadius: size,
          borderWidth: done ? 0 : 1.6,
          borderColor: priorityRing[p.task.priority],
          backgroundColor: done ? c.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done && <Check size={size - 6} color="#fff" strokeWidth={3} />}
      </Pressable>
    );
  };

  const chip = (p: PlannedTask) => {
    const done = p.task.status === "complete";
    return (
      <View
        key={p.task.id + (p.projected ? "p" : "")}
        {...handlers(p, null)}
        accessibilityRole="button"
        accessibilityLabel={`${p.task.title}, anytime`}
        className="bg-surface border-line flex-row items-center gap-1.5 rounded-[7px] border px-1.5 py-1"
        style={[{ opacity: p.projected ? 0.6 : 1, maxWidth: "100%" }, webGrab]}
      >
        {checkbox(p, 13)}
        <Text numberOfLines={1} className={`flex-shrink text-[12px] font-medium ${done ? "text-ink-3 line-through" : "text-ink"}`}>
          {p.task.title}
        </Text>
        {p.task.repeat !== "none" && <Repeat size={10} color={c.ink3} strokeWidth={2} />}
        {spaceTag(p.task, false)}
      </View>
    );
  };

  const range =
    days.length === 1
      ? `${cap(weekdayShort(days[0]!))} ${dayOfMonth(days[0]!)} ${cap(monthShort(days[0]!))}`
      : `${dayOfMonth(days[0]!)} ${cap(monthShort(days[0]!))} – ${dayOfMonth(days[days.length - 1]!)} ${cap(monthShort(days[days.length - 1]!))}`;

  // ── Settings ────────────────────────────────────────────────────────────────────────────────────
  const gearRef = useRef<View>(null);

  // ── Plan: fit the visible days' untimed tasks into their free time ──
  const placeable = (d: string) =>
    (byDay.get(d) ?? []).filter((p) => !p.projected && !p.task.due_time && p.task.status !== "complete").map((p) => p.task);
  const toPlan = days.filter((d) => d >= today).reduce((n, d) => n + placeable(d).length, 0);
  const [planNote, setPlanNote] = useState<string | null>(null);
  const planDays = () => {
    let placed = 0;
    let left = 0;
    for (const d of days) {
      if (d < today) continue;
      const tasksHere = placeable(d);
      if (tasksHere.length === 0) continue;
      const nowMin = d === today ? nowMinutes() + 10 : 0;
      const plan = autoSchedule(byDay.get(d) ?? [], tasksHere, { dayStart: prefs.startHour * 60, dayEnd: prefs.endHour * 60, notBefore: nowMin });
      for (const { id, time } of plan) {
        const t = tasksHere.find((x) => x.id === id)!;
        updateTask.mutate({
          id,
          patch: { due_date: d, due_time: time, reminder_times: rebaseReminders(t.reminder_times, anchorOf(t.due_date, t.due_time), anchorOf(d, time)) },
        });
      }
      placed += plan.length;
      left += tasksHere.length - plan.length;
    }
    setPlanNote(
      placed === 0
        ? "No free time left in your hours to fit them."
        : `Scheduled ${placed} task${placed === 1 ? "" : "s"}${left ? `; ${left} didn't fit and stay anytime` : ""}. Drag any to adjust.`,
    );
    setTimeout(() => setPlanNote(null), 5000);
  };

  // ── Plan with Nox AI (day view): the day's anytime tasks — and, today, anything overdue — laid out
  // by the model, checked against the real calendar, and shown as a proposal. Nothing moves until
  // "Schedule". The quick fit above stays as the free, offline fallback.
  const aiOn = useAiEnabled();
  const aiPlan = useAiCall(AiRepository.planDay);
  const [proposal, setProposal] = useState<null | {
    day: string;
    summary: string;
    placed: (PlacedTask & { task: Task; reason: string })[];
    skipped: { task: Task; reason: string }[];
  }>(null);
  const planDay = days[0]!;
  const planWithAi = aiOn && mode === "day" && planDay >= today;
  const aiCandidates = useMemo(() => {
    if (!planWithAi) return [];
    const isTemplate = (t: Task) => t.repeat !== "none" && t.origin_task_id === null;
    const open = (byDay.get(planDay) ?? []).filter((p) => !p.projected && p.task.status !== "complete");
    const here = open.filter((p) => !p.task.due_time).map((p) => p.task);
    if (planDay !== today) return here;
    // Today, a task whose time has come and gone without being done gets a new slot too.
    const now = nowMinutes();
    const missed = open
      .filter((p) => p.task.due_time && !isTemplate(p.task) && timeToMinutes(p.task.due_time) + lengthOf(p.task) <= now)
      .map((p) => p.task);
    const ids = new Set([...here, ...missed].map((t) => t.id));
    const overdue = tasks.filter(
      (t) =>
        !t.deleted &&
        t.status !== "complete" &&
        !!t.due_date &&
        t.due_date < today &&
        !ids.has(t.id) &&
        !isTemplate(t),
    );
    return [...here, ...missed, ...overdue];
  }, [planWithAi, byDay, planDay, today, tasks]);

  const runAiPlan = async () => {
    const day = planDay;
    const offered = aiCandidates;
    if (offered.length === 0) {
      setPlanNote(
        day === today
          ? "Nothing to plan: every open task today already has a time that's still ahead. Add a task without a time and Plan day will fit it in."
          : "Nothing to plan: every task that day already has a time. Add one without a time and Plan day will fit it in.",
      );
      setTimeout(() => setPlanNote(null), 6000);
      return;
    }
    const moving = new Set(offered.map((t) => t.id));
    // What stays put: everything else on the day. The tasks being planned don't block their own new slots.
    const planned = (byDay.get(day) ?? []).filter((p) => !moving.has(p.task.id));
    const dayStart = prefs.startHour * 60;
    const dayEnd = prefs.endHour * 60;
    const notBefore = day === today ? nowMinutes() + 10 : 0;
    setProposal(null);
    const res = await aiPlan.run({
      date: day,
      notBefore: minutesToTime(Math.max(dayStart, notBefore)),
      dayStart: minutesToTime(dayStart),
      dayEnd: minutesToTime(dayEnd),
      busy: planned
        .filter((p) => p.task.status !== "complete" && p.task.due_time)
        .map((p) => {
          const s = timeToMinutes(p.task.due_time!);
          return { title: p.task.title.slice(0, 80), start: minutesToTime(s), end: minutesToTime(s + lengthOf(p.task)) };
        }),
      tasks: offered.map((t) => ({
        id: t.id,
        title: t.title.slice(0, 120),
        priority: t.priority,
        ...(t.duration_minutes ? { minutes: t.duration_minutes } : {}),
        due: t.due_date,
        overdue: (!!t.due_date && t.due_date < today) || (!!t.due_time && t.due_date === today),
      })),
    });
    if (!res) return;
    const byId = new Map(offered.map((t) => [t.id, t]));
    // A length the user set wins over the model's estimate.
    const slots = res.slots.map((sl) => ({ ...sl, minutes: byId.get(sl.id)?.duration_minutes ?? sl.minutes }));
    const placed = checkPlan(planned, offered, slots, { dayStart, dayEnd, notBefore });
    const placedIds = new Set(placed.map((p) => p.id));
    setProposal({
      day,
      summary: res.summary,
      placed: placed.map((p) => ({ ...p, task: byId.get(p.id)!, reason: res.slots.find((sl) => sl.id === p.id)?.reason ?? "" })),
      skipped: offered
        .filter((t) => !placedIds.has(t.id))
        .map((t) => ({ task: t, reason: res.skipped.find((sk) => sk.id === t.id)?.reason || "Didn't fit today" })),
    });
  };

  const applyProposal = () => {
    if (!proposal) return;
    for (const p of proposal.placed) {
      const t = p.task;
      updateTask.mutate({
        id: t.id,
        patch: {
          due_date: proposal.day,
          due_time: p.time,
          ...(t.duration_minutes ? {} : { duration_minutes: p.minutes }),
          reminder_times: rebaseReminders(t.reminder_times, anchorOf(t.due_date, t.due_time), anchorOf(proposal.day, p.time)),
        },
      });
    }
    const n = proposal.placed.length;
    setProposal(null);
    aiPlan.reset();
    setPlanNote(`Scheduled ${n} task${n === 1 ? "" : "s"}. Drag any to adjust.`);
    setTimeout(() => setPlanNote(null), 5000);
  };
  const dismissProposal = () => {
    setProposal(null);
    aiPlan.reset();
  };
  const planCount = planWithAi ? aiCandidates.length : toPlan;

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <View ref={rootRef} collapsable={false} className="flex-1">
      {/* Toolbar */}
      <View className="px-screen flex-row items-center gap-1 pb-3">
        <Pressable onPress={() => onFocus(addDays(focus, -step))} accessibilityRole="button" accessibilityLabel="Previous" className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[9px]">
          <ChevronLeft size={18} color={c.ink2} strokeWidth={2.2} />
        </Pressable>
        <Pressable onPress={() => onFocus(addDays(focus, step))} accessibilityRole="button" accessibilityLabel="Next" className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[9px]">
          <ChevronRight size={18} color={c.ink2} strokeWidth={2.2} />
        </Pressable>
        {!days.includes(today) && (
          <Pressable onPress={() => onFocus(today)} accessibilityRole="button" className="hover:bg-chip border-line ml-1 h-8 justify-center rounded-[9px] border px-2.5">
            <Text className="text-ink-2 text-[13px] font-semibold">Today</Text>
          </Pressable>
        )}
        <Text style={TABULAR} className="text-ink ml-2 flex-1 text-[14px] font-semibold" numberOfLines={1}>
          {range}
        </Text>
        <View className="bg-chip flex-row rounded-[9px] p-0.5">
          {(["day", "week"] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setPrefs({ view: v })}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === v }}
              className={`h-7 justify-center rounded-[7px] px-2.5 ${mode === v ? "bg-surface" : ""}`}
              style={mode === v ? { shadowColor: "#1B2131", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : undefined}
            >
              <Text className={`text-[13px] font-semibold ${mode === v ? "text-ink" : "text-ink-3"}`}>
                {v === "day" ? "Day" : isDesktop ? "Week" : "3 days"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={planWithAi ? runAiPlan : planDays}
          disabled={(planCount === 0 && !planWithAi) || aiPlan.busy}
          accessibilityRole="button"
          accessibilityLabel={
            planWithAi
              ? `Plan the day with Nox AI${planCount ? ` (${planCount} task${planCount === 1 ? "" : "s"} to place)` : ""}`
              : planCount === 0
                ? "No anytime tasks to plan"
                : `Fit ${planCount} anytime tasks into free time`
          }
          {...({
            title: planWithAi
              ? "Nox AI fits in the day's tasks without a time, ones whose time has passed, and overdue ones — you review before anything moves"
              : "Fit anytime tasks into the free time, highest priority first",
          } as object)}
          style={pressScale}
          className={`h-8 flex-row items-center gap-1.5 rounded-[9px] px-2.5 ${planCount || planWithAi ? "hover:bg-chip" : "opacity-40"}`}
        >
          {aiPlan.busy ? (
            <ActivityIndicator size="small" color={c.accent} style={{ transform: [{ scale: 0.7 }] }} />
          ) : (
            <Sparkles size={14} color={planCount || planWithAi ? c.accent : c.ink3} strokeWidth={2.2} />
          )}
          {isDesktop && (
            <Text className="text-ink-2 text-[13px] font-semibold">
              {aiPlan.busy ? "Planning…" : mode === "day" ? "Plan day" : "Plan week"}
            </Text>
          )}
        </Pressable>
        <View ref={gearRef} collapsable={false}>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Calendar settings"
            style={pressScale}
            className={`h-8 w-8 items-center justify-center rounded-[9px] ${settingsOpen ? "bg-chip" : "hover:bg-chip"}`}
          >
            <Settings2 size={16} color={c.ink2} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {(proposal || aiPlan.error) && (
        <View className="mx-screen mb-2">
          <AiPanel
            title={proposal ? (proposal.placed.length ? "Here's a plan for the day" : "Nothing fits the free time") : "Couldn't plan the day"}
            onClose={dismissProposal}
            footer={
              <>
                <AiAction
                  label="Quick fit instead"
                  onPress={() => {
                    dismissProposal();
                    planDays();
                  }}
                />
                {proposal && proposal.placed.length > 0 && (
                  <AiAction primary label={`Schedule ${proposal.placed.length}`} onPress={applyProposal} />
                )}
              </>
            }
          >
            {aiPlan.error ? <Text className="text-high text-[13px]">{aiPlan.error}</Text> : null}
            {proposal ? (
              <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                {proposal.summary ? <Text className="text-ink-2 mb-2 text-[13px] leading-[19px]">{proposal.summary}</Text> : null}
                {proposal.placed.map((p) => (
                  <View key={p.id} className="flex-row items-start gap-2.5 py-1">
                    <Text style={TABULAR} className="text-ink w-[62px] pt-px text-[13px] font-semibold">
                      {formatTime12(p.time)}
                    </Text>
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-ink text-[14px] font-medium">
                        {p.task.title}
                      </Text>
                      <Text numberOfLines={2} className="text-ink-3 text-[12px]">
                        {durationLabel(p.minutes)}
                        {p.reason ? ` · ${p.reason}` : ""}
                      </Text>
                    </View>
                  </View>
                ))}
                {proposal.skipped.length > 0 && (
                  <View className="mt-1.5">
                    <Text className="text-ink-3 mb-0.5 text-[12px] font-semibold">Left as anytime</Text>
                    {proposal.skipped.map((sk) => (
                      <Text key={sk.task.id} numberOfLines={1} className="text-ink-3 text-[13px]">
                        {sk.task.title} — {sk.reason}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : null}
          </AiPanel>
        </View>
      )}

      {planNote && (
        <View className="bg-accent/[0.08] mx-screen mb-2 flex-row items-center gap-2 rounded-[10px] px-3 py-2">
          <Sparkles size={13} color={c.accent} strokeWidth={2.2} />
          <Text className="text-ink-2 flex-1 text-[13px]">{planNote}</Text>
        </View>
      )}

      {/* Day headers */}
      <View className="border-line flex-row border-b" style={{ paddingLeft: GUTTER }}>
        {days.map((d) => {
          const isToday = d === today;
          return (
            <Pressable
              key={d}
              onPress={() => {
                onFocus(d);
                if (mode === "week") setPrefs({ view: "day" });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open ${cap(weekdayShort(d))} ${dayOfMonth(d)}`}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2"
            >
              <Text className={`text-[12px] font-semibold ${isToday ? "text-accent" : "text-ink-3"}`}>{cap(weekdayShort(d))}</Text>
              <View className={`h-6 min-w-[24px] items-center justify-center rounded-full px-1 ${isToday ? "bg-accent" : ""}`}>
                <Text style={TABULAR} className={`text-[13px] font-bold ${isToday ? "text-on-accent" : "text-ink"}`}>
                  {dayOfMonth(d)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Anytime row — also the drop zone for unscheduling */}
      <View className="border-line flex-row border-b">
        <View style={{ width: GUTTER }} className="justify-center pr-2">
          <Text className="text-ink-3 text-right text-[11px] font-medium">Anytime</Text>
        </View>
        <View ref={trayRef} collapsable={false} className="flex-1 flex-row">
          {days.map((d) => {
            const all = (byDay.get(d) ?? []).filter((p) => !p.task.due_time);
            const max = 3;
            const list = (trayOpen && mode === "day") || all.length <= max ? all : all.slice(0, max - 1);
            const hot = drag?.target && drag.target.time === null && drag.target.day === d;
            return (
              <View
                key={d}
                className={`border-line min-h-[40px] flex-1 gap-1 border-l px-1 py-1.5 ${hot ? "bg-accent/[0.08]" : ""}`}
                style={trayOpen && mode === "day" ? undefined : { maxHeight: 112, overflow: "hidden" }}
              >
                {list.map(chip)}
                {all.length > list.length && (
                  <Pressable
                    onPress={() => {
                      onFocus(d);
                      setPrefs({ view: "day" });
                      setTrayOpen(true);
                    }}
                    accessibilityRole="button"
                    className="hover:bg-chip self-start rounded-[6px] px-1.5 py-0.5"
                  >
                    <Text className="text-ink-2 text-[12px] font-semibold">+{all.length - list.length} more</Text>
                  </Pressable>
                )}
                {all.length === 0 && (
                  <Pressable onPress={() => onCreateAt(d, null)} className="hover:bg-chip flex-1 items-center justify-center rounded-[6px]" accessibilityLabel={`Add an anytime task on ${d}`}>
                    <Plus size={13} color={c.line} strokeWidth={2} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Hour grid */}
      <ScrollView ref={scroller} className="flex-1" scrollEnabled={!drag} showsVerticalScrollIndicator={false}>
        <View className="flex-row" style={{ height: hours.length * ROW + 12 }}>
          <View style={{ width: GUTTER }}>
            {hours.map((h) => (
              <Text
                key={h}
                style={[TABULAR, { position: "absolute", top: (h - startHour) * ROW - 7, right: 8 }]}
                className="text-ink-3 text-[11px]"
              >
                {h === startHour ? "" : hourLabel(h)}
              </Text>
            ))}
          </View>
          <View ref={gridRef} collapsable={false} className="flex-1 flex-row" style={{ height: hours.length * ROW }}>
            {days.map((d) => {
              const placed = layoutDay(byDay.get(d) ?? []);
              return (
                <View key={d} className="border-line relative flex-1 border-l">
                  {/* Slots: click to add a task at that half hour */}
                  {hours.map((h) => (
                    <View key={h} className="border-line border-t" style={{ height: ROW }}>
                      {[0, 30].map((m) => (
                        <Pressable
                          key={m}
                          onPress={() => onCreateAt(d, minutesToTime(h * 60 + m))}
                          accessibilityLabel={`Add a task at ${formatTime12(minutesToTime(h * 60 + m))}`}
                          className="hover:bg-accent/[0.05] flex-1"
                        />
                      ))}
                    </View>
                  ))}

                  {/* Now */}
                  {d === today && now >= startHour * 60 && now <= endHour * 60 && (
                    <View pointerEvents="none" className="absolute left-0 right-0 flex-row items-center" style={{ top: yOf(now) - 4 }}>
                      <View className="bg-critical h-2 w-2 rounded-full" style={{ marginLeft: -4 }} />
                      <View className="bg-critical h-[1.5px] flex-1" />
                    </View>
                  )}

                  {/* Tasks */}
                  {placed.map(({ p, start, lane, lanes }) => {
                    const done = p.task.status === "complete";
                    const minutes = resize?.id === p.task.id ? resize.minutes : lengthOf(p.task);
                    const h = Math.max(22, (minutes / 60) * ROW - 3);
                    const tall = h >= 44;
                    const dragging = drag?.task.id === p.task.id;
                    return (
                      <View
                        key={p.task.id + (p.projected ? "p" : "")}
                        {...handlers(p, start)}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.task.title}, ${formatTime12(p.task.due_time)}, ${durationLabel(minutes)}`}
                        className={`absolute flex-row gap-1.5 overflow-hidden rounded-[7px] px-1.5 ${tall ? "items-start pt-1.5" : "items-center"}`}
                        style={[
                          {
                            top: yOf(start) + 1,
                            height: h,
                            left: `${(lane / lanes) * 100}%`,
                            width: `${100 / lanes}%`,
                            paddingRight: 6,
                            backgroundColor: done ? c.chip : withAlpha(priorityRing[p.task.priority], 0.14),
                            borderLeftWidth: 3,
                            borderLeftColor: done ? c.line : priorityRing[p.task.priority],
                            opacity: dragging ? 0.35 : p.projected ? 0.6 : 1,
                            borderStyle: p.projected ? "dashed" : "solid",
                          },
                          webGrab,
                        ]}
                      >
                        {checkbox(p, 14)}
                        <View className="min-w-0 flex-1">
                          <Text numberOfLines={tall ? 2 : 1} className={`text-[12px] font-semibold ${done ? "text-ink-3 line-through" : "text-ink"}`}>
                            {p.task.title}
                          </Text>
                          {tall && (
                            <Text numberOfLines={1} style={TABULAR} className="text-ink-3 mt-0.5 text-[11px]">
                              {formatTime12(p.task.due_time)} – {formatTime12(minutesToTime(start + minutes))}
                            </Text>
                          )}
                          {tall && p.task.space_id ? <View className="mt-1 flex-row">{spaceTag(p.task, lanes === 1)}</View> : null}
                        </View>
                        {!tall ? spaceTag(p.task, isDesktop && lanes === 1) : null}
                        {!tall && isDesktop && lanes === 1 && (
                          <Text style={TABULAR} className="text-ink-3 text-[11px]">
                            {resize?.id === p.task.id ? durationLabel(minutes) : formatTime12(p.task.due_time)}
                          </Text>
                        )}
                        {tall && resize?.id === p.task.id && (
                          <Text style={TABULAR} className="text-ink-2 text-[11px] font-semibold">
                            {durationLabel(minutes)}
                          </Text>
                        )}
                        {/* Bottom edge: drag to change how long it takes */}
                        {!p.projected && !done && (
                          <View
                            {...resizeHandlers(p.task)}
                            accessibilityRole="adjustable"
                            accessibilityLabel={`Duration of ${p.task.title}: ${durationLabel(minutes)}. Drag to change.`}
                            className="absolute bottom-0 left-0 right-0 items-center justify-end"
                            style={[{ height: 8 }, Platform.OS === "web" ? ({ cursor: "ns-resize" } as object) : null]}
                          >
                            {/* The grip shows only when the block is tall enough not to run into the title. */}
                            {tall && <View className="mb-[2px] h-[3px] w-6 rounded-full" style={{ backgroundColor: priorityRing[p.task.priority], opacity: 0.45 }} />}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Where a dragged task will land */}
                  {drag?.target?.time && drag.target.day === d && (
                    <View
                      pointerEvents="none"
                      className="border-accent absolute left-0.5 right-0.5 rounded-[7px] border-2 border-dashed"
                      style={{ top: yOf(timeToMinutes(drag.target.time)) + 1, height: Math.max(22, (lengthOf(drag.task) / 60) * ROW - 3) }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* The dragged task, under the pointer */}
      {drag && geom.current.root && (
        <View
          pointerEvents="none"
          className="bg-ink absolute flex-row items-center gap-2 rounded-[9px] px-2.5 py-1.5"
          style={{
            left: drag.x - geom.current.root.x + 12,
            top: drag.y - geom.current.root.y + 12,
            maxWidth: 260,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text numberOfLines={1} className="text-bg text-[13px] font-semibold">
            {drag.task.title}
          </Text>
          <Text style={TABULAR} className="text-bg text-[12px] opacity-70">
            {drag.target
              ? `${days.length > 1 ? cap(weekdayShort(drag.target.day)) + " · " : ""}${drag.target.time ? formatTime12(drag.target.time) : "Anytime"}`
              : "—"}
          </Text>
        </View>
      )}

      <Popover anchorRef={gearRef} open={settingsOpen} onClose={() => setSettingsOpen(false)} width={270} accessibilityLabel="Calendar settings">
        <CalendarSettings prefs={prefs} onChange={setPrefs} isDesktop={isDesktop} />
      </Popover>
    </View>
  );
}

const webGrab = Platform.OS === "web" ? ({ cursor: "grab", userSelect: "none" } as object) : null;

function Stepper({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center px-2.5 py-1.5">
      <Text className="text-ink flex-1 text-[14px]">{label}</Text>
      <Pressable onPress={onDec} accessibilityRole="button" accessibilityLabel={`Earlier ${label.toLowerCase()}`} className="hover:bg-chip h-7 w-7 items-center justify-center rounded-[7px]">
        <Minus size={13} color={c.ink2} strokeWidth={2.4} />
      </Pressable>
      <Text style={TABULAR} className="text-ink w-[54px] text-center text-[13px] font-semibold">
        {value}
      </Text>
      <Pressable onPress={onInc} accessibilityRole="button" accessibilityLabel={`Later ${label.toLowerCase()}`} className="hover:bg-chip h-7 w-7 items-center justify-center rounded-[7px]">
        <Plus size={13} color={c.ink2} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} className="hover:bg-chip flex-row items-center rounded-[8px] px-2.5 py-2">
      <Text className="text-ink flex-1 text-[14px]">{label}</Text>
      <View style={{ width: 30, height: 18, borderRadius: 99, padding: 2, alignItems: on ? "flex-end" : "flex-start", backgroundColor: on ? c.accent : c.chip, borderWidth: on ? 0 : 1, borderColor: c.line }}>
        <View style={{ width: 14, height: 14, borderRadius: 99, backgroundColor: on ? "#fff" : c.ink3 }} />
      </View>
    </Pressable>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View className="flex-row items-center px-2.5 py-1.5">
      <Text className="text-ink flex-1 text-[14px]">{label}</Text>
      <View className="bg-chip flex-row rounded-[8px] p-0.5">
        {options.map((o) => (
          <Pressable key={String(o.v)} onPress={() => onChange(o.v)} accessibilityRole="radio" accessibilityState={{ checked: value === o.v }} className={`rounded-[6px] px-2 py-1 ${value === o.v ? "bg-surface" : ""}`}>
            <Text className={`text-[12px] font-semibold ${value === o.v ? "text-ink" : "text-ink-3"}`}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CalendarSettings({ prefs, onChange, isDesktop }: { prefs: CalendarPrefs; onChange: (p: Partial<CalendarPrefs>) => void; isDesktop: boolean }): ReactNode {
  return (
    <View className="p-1.5">
      <MenuLabel>Hours shown</MenuLabel>
      <Stepper
        label="Day starts"
        value={hourLabel(prefs.startHour)}
        onDec={() => onChange({ startHour: Math.max(0, prefs.startHour - 1) })}
        onInc={() => onChange({ startHour: Math.min(prefs.endHour - 1, prefs.startHour + 1) })}
      />
      <Stepper
        label="Day ends"
        value={hourLabel(prefs.endHour)}
        onDec={() => onChange({ endHour: Math.max(prefs.startHour + 1, prefs.endHour - 1) })}
        onInc={() => onChange({ endHour: Math.min(24, prefs.endHour + 1) })}
      />
      <MenuDivider />
      {isDesktop && (
        <>
          <Choice label="Week starts" value={prefs.weekStartsOn} options={[{ v: 1, label: "Mon" }, { v: 0, label: "Sun" }]} onChange={(v) => onChange({ weekStartsOn: v as 0 | 1 })} />
          <Toggle label="Show weekends" on={prefs.showWeekends} onPress={() => onChange({ showWeekends: !prefs.showWeekends })} />
        </>
      )}
      <Toggle label="Show completed" on={prefs.showCompleted} onPress={() => onChange({ showCompleted: !prefs.showCompleted })} />
      <Choice label="Rows" value={prefs.density} options={[{ v: "compact", label: "Compact" }, { v: "comfortable", label: "Roomy" }]} onChange={(v) => onChange({ density: v })} />
    </View>
  );
}
