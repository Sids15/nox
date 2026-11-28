// What reminders are due for one person right now, worked out in their own time zone. Pure, so it's
// unit-tested; index.ts feeds it the clock, preferences and counts, and does the sending.
// Messages carry counts only — never task titles or space names (remote push is IDs-only).

export interface PushPrefs {
  morning: boolean;
  overdue: boolean;
  deadlines: boolean;
  /** Local hour (0–23) for the morning summary. */
  hour: number;
}

export const DEFAULT_PREFS: PushPrefs = { morning: true, overdue: true, deadlines: true, hour: 8 };

/** Local hour of the overdue nudge, and of the deadline alert. */
export const OVERDUE_HOUR = 17;
export const DEADLINE_HOUR = 9;

export type PushKind = "morning" | "overdue" | "deadlines";

export interface Counts {
  /** Open tasks due today. */
  today: number;
  /** Open tasks due before today. */
  overdue: number;
  /** Spaces whose deadline is today, tomorrow or the day after. */
  deadlines: number;
}

export interface Message {
  kind: PushKind;
  title: string;
  body: string;
  /** Where tapping it opens. */
  url: string;
}

/** Preferences as stored (any JSON) → valid preferences. */
export function readPrefs(raw: unknown): PushPrefs {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hour = Number(r.hour);
  return {
    morning: r.morning !== false,
    overdue: r.overdue !== false,
    deadlines: r.deadlines !== false,
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_PREFS.hour,
  };
}

/** The local day ("YYYY-MM-DD") and hour in a time zone; an unknown zone counts as UTC. */
export function localClock(now: Date, tz: string): { day: string; hour: number; tz: string } {
  let zone = tz;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  } catch {
    zone = "UTC";
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24, tz: zone };
}

/** Which kinds could go out at this local hour (before looking at counts — so most runs query nothing). */
export function dueKinds(prefs: PushPrefs, hour: number): PushKind[] {
  const out: PushKind[] = [];
  if (prefs.morning && hour === prefs.hour) out.push("morning");
  if (prefs.overdue && hour === OVERDUE_HOUR) out.push("overdue");
  if (prefs.deadlines && hour === DEADLINE_HOUR) out.push("deadlines");
  return out;
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The messages to send for the due kinds, given the counts. Nothing to say → nothing sent. */
export function messages(kinds: PushKind[], c: Counts): Message[] {
  const out: Message[] = [];
  for (const kind of kinds) {
    if (kind === "morning" && c.today + c.overdue > 0) {
      const parts = [c.today > 0 ? `${n(c.today, "task", "tasks")} today` : null, c.overdue > 0 ? `${c.overdue} overdue` : null].filter(Boolean);
      out.push({ kind, title: "Good morning", body: `${parts.join(" · ")}. Open Nox to plan your day.`, url: "/tasks" });
    }
    if (kind === "overdue" && c.overdue > 0) {
      out.push({ kind, title: n(c.overdue, "task is overdue", "tasks are overdue"), body: "Give them a new day, or let them go, in your weekly review.", url: "/review" });
    }
    if (kind === "deadlines" && c.deadlines > 0) {
      out.push({ kind, title: "A deadline is close", body: `${n(c.deadlines, "space is", "spaces are")} due within 2 days.`, url: "/spaces" });
    }
  }
  return out;
}
