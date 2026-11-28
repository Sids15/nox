// Google Calendar ↔ Nox tasks, as pure functions (unit-tested). index.ts does the HTTP.
//
// Timed Nox tasks become events on the person's primary calendar, tagged with the task id in a
// private extended property. Each pair is remembered (gcal_links) with when it was last in step;
// whichever side changed since then wins (the later change, if both did).

export interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  duration_minutes: number | null;
  status: string;
  deleted: boolean;
  repeat: string;
  origin_task_id: string | null;
  updated_at: string;
}

export interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  htmlLink?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export interface Link {
  task_id: string;
  event_id: string;
  /** When the pair was last in step (ISO). */
  synced_at: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const DEFAULT_MINUTES = 30;

/** Whether a task belongs on the calendar: has a day and a time, isn't deleted or a repeating rule. */
export const pushable = (t: TaskRow) => !t.deleted && !!t.due_date && !!t.due_time && !(t.repeat !== "none" && t.origin_task_id === null);

/** "YYYY-MM-DDTHH:MM:00" plus minutes, as local wall-clock text (no zone). */
function addMinutes(day: string, time: string, minutes: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00`;
}

/** The Google event for a task, in the person's time zone. */
export function taskToEvent(t: TaskRow, tz: string) {
  const time = t.due_time!.slice(0, 5);
  const minutes = t.duration_minutes || DEFAULT_MINUTES;
  return {
    summary: `${t.status === "complete" ? "✓ " : ""}${t.title}`.slice(0, 1000),
    description: "From Nox",
    start: { dateTime: addMinutes(t.due_date!, time, 0), timeZone: tz },
    end: { dateTime: addMinutes(t.due_date!, time, minutes), timeZone: tz },
    extendedProperties: { private: { noxTaskId: t.id } },
  };
}

/** An instant as wall-clock day and time in a time zone. */
export function wallClock(iso: string, tz: string): { day: string; time: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  } catch {
    return null;
  }
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "00";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, time: `${pad(Number(get("hour")) % 24)}:${get("minute")}` };
}

/** What changed on a linked event, as a patch for its task (null: nothing to change). */
export function eventToTaskPatch(e: GEvent, t: TaskRow, tz: string): Partial<Pick<TaskRow, "title" | "due_date" | "due_time" | "duration_minutes">> | null {
  const patch: Partial<Pick<TaskRow, "title" | "due_date" | "due_time" | "duration_minutes">> = {};
  const title = (e.summary ?? "").replace(/^✓\s*/, "").trim().slice(0, 200);
  if (title && title !== t.title) patch.title = title;
  if (e.start?.date) {
    // Made an all-day event: the task keeps the day, loses its time.
    if (e.start.date !== t.due_date) patch.due_date = e.start.date;
    if (t.due_time) patch.due_time = null;
  } else if (e.start?.dateTime && e.end?.dateTime) {
    const s = wallClock(e.start.dateTime, tz);
    if (!s) return Object.keys(patch).length ? patch : null;
    if (s.day !== t.due_date) patch.due_date = s.day;
    if (s.time !== (t.due_time ?? "").slice(0, 5)) patch.due_time = s.time;
    const minutes = Math.round((new Date(e.end.dateTime).getTime() - new Date(e.start.dateTime).getTime()) / 60_000);
    if (minutes >= 5 && minutes <= 1440 && minutes !== (t.duration_minutes || DEFAULT_MINUTES)) patch.duration_minutes = minutes;
  }
  return Object.keys(patch).length ? patch : null;
}

export type Step =
  | { op: "create-event"; task: TaskRow }
  | { op: "update-event"; task: TaskRow; eventId: string }
  | { op: "delete-event"; taskId: string; eventId: string }
  | { op: "update-task"; task: TaskRow; eventId: string; patch: NonNullable<ReturnType<typeof eventToTaskPatch>> }
  /** The event was deleted in Google: the task keeps its day but comes off the calendar. */
  | { op: "untime-task"; taskId: string; eventId: string }
  | { op: "noop-link"; taskId: string; eventId: string };

/**
 * One sync: what to do on each side. `tasks` are the person's tasks in the sync window (and any
 * linked ones), `events` the linked events as Google has them now (a missing or cancelled one was
 * deleted there). With `pushTasks` off, nothing new goes to Google but existing pairs stay in step.
 */
export function syncPlan(tasks: TaskRow[], links: Link[], events: Map<string, GEvent | null>, tz: string, pushTasks: boolean): Step[] {
  const steps: Step[] = [];
  const byTask = new Map(links.map((l) => [l.task_id, l] as const));
  const taskById = new Map(tasks.map((t) => [t.id, t] as const));

  for (const l of links) {
    const t = taskById.get(l.task_id);
    const e = events.get(l.event_id);
    const goneThere = e === null || e?.status === "cancelled";
    if (!t || !pushable(t)) {
      if (!goneThere) steps.push({ op: "delete-event", taskId: l.task_id, eventId: l.event_id });
      else steps.push({ op: "noop-link", taskId: l.task_id, eventId: l.event_id });
      continue;
    }
    if (goneThere) {
      steps.push({ op: "untime-task", taskId: t.id, eventId: l.event_id });
      continue;
    }
    if (e === undefined) continue; // not fetched this time
    const taskChanged = t.updated_at > l.synced_at;
    const eventChanged = (e.updated ?? "") > l.synced_at;
    const patch = eventToTaskPatch(e, t, tz);
    if (eventChanged && patch && (!taskChanged || (e.updated ?? "") > t.updated_at)) steps.push({ op: "update-task", task: t, eventId: l.event_id, patch });
    else if (taskChanged) steps.push({ op: "update-event", task: t, eventId: l.event_id });
  }

  if (pushTasks) for (const t of tasks) if (pushable(t) && !byTask.has(t.id)) steps.push({ op: "create-event", task: t });
  return steps;
}

/** A Google event as the app shows it (busy time on the Tasks calendar). Nox's own events are left out. */
export function eventForApp(e: GEvent) {
  if (e.status === "cancelled" || e.extendedProperties?.private?.noxTaskId) return null;
  const allDay = !!e.start?.date;
  const start = e.start?.dateTime ?? e.start?.date;
  const end = e.end?.dateTime ?? e.end?.date;
  if (!start || !end) return null;
  return { id: e.id, title: (e.summary ?? "Busy").slice(0, 200), start, end, allDay, link: e.htmlLink?.startsWith("https://") ? e.htmlLink : null };
}
