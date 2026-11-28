import type { GoogleEvent } from "@nox/types";
import { toDateKey } from "@nox/utils";

export interface DayEvent {
  id: string;
  title: string;
  link: string | null;
  /** Minutes after local midnight on that day. */
  start: number;
  end: number;
}

/**
 * Timed Google events cut into local days (an event across midnight shows on both). All-day events
 * are left out: they don't block time on the grid.
 */
export function eventsByDay(events: GoogleEvent[], days: string[]): Map<string, DayEvent[]> {
  const want = new Set(days);
  const out = new Map<string, DayEvent[]>();
  for (const e of events) {
    if (e.allDay) continue;
    const s = new Date(e.start);
    const f = new Date(e.end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(f.getTime()) || f <= s) continue;
    for (let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d < f; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(d);
      const dayStart = d.getTime();
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      const a = Math.max(s.getTime(), dayStart);
      const b = Math.min(f.getTime(), dayEnd);
      if (b <= a || !want.has(key)) continue;
      const list = out.get(key) ?? [];
      list.push({ id: e.id, title: e.title, link: e.link, start: Math.round((a - dayStart) / 60_000), end: Math.round((b - dayStart) / 60_000) });
      out.set(key, list);
    }
  }
  for (const list of out.values()) list.sort((x, y) => x.start - y.start);
  return out;
}

/** The same, as [start, end] busy blocks per day for Plan my week. */
export function busyByDay(events: GoogleEvent[], days: string[]): Record<string, [number, number][]> {
  const out: Record<string, [number, number][]> = {};
  for (const [day, list] of eventsByDay(events, days)) out[day] = list.map((e) => [e.start, e.end]);
  return out;
}
