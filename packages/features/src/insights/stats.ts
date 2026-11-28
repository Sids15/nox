import type { FocusSession, Space, Task } from "@nox/types";
import { addDays, toDateKey } from "@nox/utils";

/**
 * The numbers behind the weekly Review and Insights, as plain functions of tasks, focus sessions and
 * today's date (a `YYYY-MM-DD` key in the user's time zone). Days are local calendar days.
 */

const isTemplate = (t: Task) => t.repeat !== "none" && t.origin_task_id === null;
const live = (tasks: Task[]) => tasks.filter((t) => !t.deleted && !isTemplate(t));

/** The local day a task was finished: `completed_at` (migration 0017), else its last change. */
export function doneDay(t: Task): string | null {
  if (t.status !== "complete") return null;
  return toDateKey(new Date(t.completed_at ?? t.updated_at));
}

const sessionDay = (s: FocusSession) => toDateKey(new Date(s.started_at));

/** The 7 days ending today: [today − 6, today]. */
export function lastSevenDays(today: string): { from: string; to: string } {
  return { from: addDays(today, -6), to: today };
}

const within = (day: string | null, from: string, to: string) => day !== null && day >= from && day <= to;

export interface WeekReview {
  from: string;
  to: string;
  /** Finished in the last 7 days, newest first. */
  done: Task[];
  /** Still open and past their day. */
  slipped: Task[];
  /** Open and due in the next 7 days (from tomorrow), by day. */
  upcoming: Task[];
  /** Minutes focused in the last 7 days. */
  focusMinutes: number;
  /** Per space (null = no space): tasks done and minutes focused this week, busiest first. */
  bySpace: { spaceId: string | null; done: number; minutes: number }[];
}

/** What the weekly Review walks through. */
export function weekReview(tasks: Task[], sessions: FocusSession[], today: string): WeekReview {
  const { from, to } = lastSevenDays(today);
  const all = live(tasks);
  const done = all
    .filter((t) => within(doneDay(t), from, to))
    .sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at));
  const open = all.filter((t) => t.status === "pending");
  const slipped = open
    .filter((t) => t.due_date !== null && t.due_date < today)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || a.title.localeCompare(b.title));
  const upcoming = open
    .filter((t) => within(t.due_date, addDays(today, 1), addDays(today, 7)))
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || (a.due_time ?? "99").localeCompare(b.due_time ?? "99"));
  const week = sessions.filter((s) => !s.deleted && within(sessionDay(s), from, to));
  const focusMinutes = week.reduce((a, s) => a + s.minutes, 0);

  const per = new Map<string | null, { done: number; minutes: number }>();
  const bump = (id: string | null, k: "done" | "minutes", n: number) => {
    const e = per.get(id) ?? { done: 0, minutes: 0 };
    e[k] += n;
    per.set(id, e);
  };
  for (const t of done) bump(t.space_id ?? null, "done", 1);
  for (const s of week) bump(s.space_id, "minutes", s.minutes);
  const bySpace = [...per.entries()]
    .map(([spaceId, v]) => ({ spaceId, ...v }))
    .sort((a, b) => b.minutes - a.minutes || b.done - a.done);

  return { from, to, done, slipped, upcoming, focusMinutes, bySpace };
}

export interface Insights {
  /** Tasks finished in each of the last `weeks` 7-day blocks, oldest first (the last ends today). */
  weeklyDone: { from: string; to: string; count: number }[];
  /** Minutes focused on each of the last 14 days, oldest first. */
  dailyFocus: { day: string; minutes: number }[];
  /** Days in a row, up to today, with at least one task finished (today counts once it has one). */
  streak: number;
  /** Of tasks with a day that were finished in the last 30 days: how many on or before that day. */
  onTime: { onTime: number; total: number };
  /** Weekday (0 = Sunday) with the most tasks finished in the last 8 weeks, or null if none. */
  bestWeekday: number | null;
  /** Focus minutes per space over the last 30 days, most first (null = no space). */
  focusBySpace: { spaceId: string | null; minutes: number }[];
  /** This week vs the 7 days before it. */
  thisWeek: { done: number; focus: number };
  lastWeek: { done: number; focus: number };
}

export function insights(tasks: Task[], sessions: FocusSession[], today: string, weeks = 8): Insights {
  const all = live(tasks);
  const days = all.map(doneDay).filter((d): d is string => d !== null);
  const countIn = (from: string, to: string) => days.filter((d) => d >= from && d <= to).length;
  const focus = sessions.filter((s) => !s.deleted);
  const focusIn = (from: string, to: string) => focus.filter((s) => within(sessionDay(s), from, to)).reduce((a, s) => a + s.minutes, 0);

  const weeklyDone = Array.from({ length: weeks }, (_, i) => {
    const to = addDays(today, -7 * (weeks - 1 - i));
    const from = addDays(to, -6);
    return { from, to, count: countIn(from, to) };
  });

  const dailyFocus = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i - 13);
    return { day, minutes: focusIn(day, day) };
  });

  const doneDays = new Set(days);
  let streak = 0;
  // A streak still counts this morning before anything's done today: start from yesterday then.
  let cursor = doneDays.has(today) ? today : addDays(today, -1);
  while (doneDays.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const monthAgo = addDays(today, -29);
  const dated = all.filter((t) => t.due_date !== null && within(doneDay(t), monthAgo, today));
  const onTime = { onTime: dated.filter((t) => doneDay(t)! <= t.due_date!).length, total: dated.length };

  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const d of days) if (d >= addDays(today, -7 * 8 + 1) && d <= today) byWeekday[new Date(`${d}T12:00:00`).getDay()]!++;
  const max = Math.max(...byWeekday);
  const bestWeekday = max > 0 ? byWeekday.indexOf(max) : null;

  const per = new Map<string | null, number>();
  for (const s of focus) if (within(sessionDay(s), monthAgo, today)) per.set(s.space_id, (per.get(s.space_id) ?? 0) + s.minutes);
  const focusBySpace = [...per.entries()].map(([spaceId, minutes]) => ({ spaceId, minutes })).sort((a, b) => b.minutes - a.minutes);

  const thisFrom = addDays(today, -6);
  const lastTo = addDays(today, -7);
  const lastFrom = addDays(today, -13);
  return {
    weeklyDone,
    dailyFocus,
    streak,
    onTime,
    bestWeekday,
    focusBySpace,
    thisWeek: { done: countIn(thisFrom, today), focus: focusIn(thisFrom, today) },
    lastWeek: { done: countIn(lastFrom, lastTo), focus: focusIn(lastFrom, lastTo) },
  };
}

/** A space's name for a stats row (null → "No space"; a deleted space → "Removed space"). */
export function spaceLabel(spaces: Space[], id: string | null): string {
  if (id === null) return "No space";
  return spaces.find((s) => s.id === id)?.name ?? "Removed space";
}
