/**
 * The focus timer as plain data, so it survives leaving the page or closing the app: when it
 * started, how long it's meant to run, and the time spent paused. Everything else is worked out
 * from these and the clock.
 */
export interface FocusTimer {
  /** The task being worked on, or null for "just focus". */
  taskId: string | null;
  /** The task's space at the start (kept so the minutes count toward it). */
  spaceId: string | null;
  /** Epoch ms when it started. */
  startedAt: number;
  /** How long it should run, in minutes. */
  plannedMinutes: number;
  /** Epoch ms when it was paused, or null while running. */
  pausedAt: number | null;
  /** Total ms spent paused before the current pause. */
  pausedMs: number;
}

export const FOCUS_LENGTHS = [15, 25, 45, 60, 90] as const;
const MIN = 60_000;

export function startTimer(taskId: string | null, spaceId: string | null, plannedMinutes: number, now: number): FocusTimer {
  const planned = Math.min(600, Math.max(1, Math.round(plannedMinutes)));
  return { taskId, spaceId, startedAt: now, plannedMinutes: planned, pausedAt: null, pausedMs: 0 };
}

/** Focused time so far (pauses don't count), never more than planned. */
export function elapsedMs(t: FocusTimer, now: number): number {
  const end = t.pausedAt ?? now;
  return Math.min(t.plannedMinutes * MIN, Math.max(0, end - t.startedAt - t.pausedMs));
}

export function remainingMs(t: FocusTimer, now: number): number {
  return Math.max(0, t.plannedMinutes * MIN - elapsedMs(t, now));
}

export const isFinished = (t: FocusTimer, now: number) => remainingMs(t, now) === 0;

export function pauseTimer(t: FocusTimer, now: number): FocusTimer {
  return t.pausedAt === null ? { ...t, pausedAt: now } : t;
}

export function resumeTimer(t: FocusTimer, now: number): FocusTimer {
  return t.pausedAt === null ? t : { ...t, pausedMs: t.pausedMs + (now - t.pausedAt), pausedAt: null };
}

/** When it will end if left running (epoch ms), or null while paused. */
export function endsAt(t: FocusTimer, now: number): number | null {
  return t.pausedAt === null ? now + remainingMs(t, now) : null;
}

/** Whole minutes worth logging: rounded, and nothing under a minute. */
export function minutesToLog(t: FocusTimer, now: number): number {
  return Math.round(elapsedMs(t, now) / MIN);
}

/** "24:59", or "1:02:03" past an hour. */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** "1h 25m", "40m", "0m". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
