import { describe, expect, test } from "bun:test";
import { eventForApp, eventToTaskPatch, pushable, syncPlan, taskToEvent, wallClock, type GEvent, type TaskRow } from "./map";

const task = (p: Partial<TaskRow> = {}): TaskRow => ({
  id: "t1",
  title: "Film intro",
  due_date: "2026-11-30",
  due_time: "14:00:00",
  duration_minutes: 90,
  status: "pending",
  deleted: false,
  repeat: "none",
  origin_task_id: null,
  updated_at: "2026-11-28T10:00:00Z",
  ...p,
});
const TZ = "Europe/London";

describe("taskToEvent", () => {
  test("a timed task becomes an event in the person's zone, tagged with its id", () => {
    expect(taskToEvent(task(), TZ)).toEqual({
      summary: "Film intro",
      description: "From Nox",
      start: { dateTime: "2026-11-30T14:00:00", timeZone: TZ },
      end: { dateTime: "2026-11-30T15:30:00", timeZone: TZ },
      extendedProperties: { private: { noxTaskId: "t1" } },
    });
  });
  test("30 minutes when no length; past midnight rolls over; done is ticked", () => {
    const e = taskToEvent(task({ due_time: "23:45", duration_minutes: null, status: "complete" }), TZ);
    expect(e.end.dateTime).toBe("2026-12-01T00:15:00");
    expect(e.summary).toBe("✓ Film intro");
  });
});

describe("pushable", () => {
  test("only timed, live, real tasks", () => {
    expect(pushable(task())).toBe(true);
    expect(pushable(task({ due_time: null }))).toBe(false);
    expect(pushable(task({ deleted: true }))).toBe(false);
    expect(pushable(task({ repeat: "daily", origin_task_id: null }))).toBe(false);
    expect(pushable(task({ repeat: "daily", origin_task_id: "tpl" }))).toBe(true);
  });
});

describe("wallClock", () => {
  test("an instant as local day and time", () => {
    expect(wallClock("2026-11-30T15:00:00+01:00", TZ)).toEqual({ day: "2026-11-30", time: "14:00" });
    expect(wallClock("2026-11-30T23:30:00Z", "Asia/Kolkata")).toEqual({ day: "2026-12-01", time: "05:00" });
    expect(wallClock("nope", TZ)).toBeNull();
  });
});

describe("eventToTaskPatch", () => {
  const ev = (p: Partial<GEvent>): GEvent => ({ id: "e1", summary: "Film intro", start: { dateTime: "2026-11-30T14:00:00Z" }, end: { dateTime: "2026-11-30T15:30:00Z" }, ...p });
  test("in step: nothing", () => {
    expect(eventToTaskPatch(ev({}), task(), TZ)).toBeNull();
  });
  test("moved and resized in Google: new day, time and length", () => {
    expect(eventToTaskPatch(ev({ start: { dateTime: "2026-12-01T09:00:00Z" }, end: { dateTime: "2026-12-01T10:00:00Z" } }), task(), TZ)).toEqual({ due_date: "2026-12-01", due_time: "09:00", duration_minutes: 60 });
  });
  test("renamed (a tick isn't part of the name)", () => {
    expect(eventToTaskPatch(ev({ summary: "✓ Film the intro" }), task(), TZ)).toEqual({ title: "Film the intro" });
    expect(eventToTaskPatch(ev({ summary: "✓ Film intro" }), task(), TZ)).toBeNull();
  });
  test("made all-day: keeps the day, drops the time", () => {
    expect(eventToTaskPatch(ev({ start: { date: "2026-12-02" }, end: { date: "2026-12-03" } }), task(), TZ)).toEqual({ due_date: "2026-12-02", due_time: null });
  });
});

describe("syncPlan", () => {
  const link = { task_id: "t1", event_id: "e1", synced_at: "2026-11-28T12:00:00Z" };
  const event = (p: Partial<GEvent> = {}): GEvent => ({ id: "e1", summary: "Film intro", updated: "2026-11-28T11:00:00Z", start: { dateTime: "2026-11-30T14:00:00Z" }, end: { dateTime: "2026-11-30T15:30:00Z" }, ...p });

  test("new timed tasks go to Google (unless pushing is off)", () => {
    expect(syncPlan([task()], [], new Map(), TZ, true)).toEqual([{ op: "create-event", task: task() }]);
    expect(syncPlan([task()], [], new Map(), TZ, false)).toEqual([]);
  });

  test("changed in Nox since the last sync: update the event", () => {
    const t = task({ updated_at: "2026-11-28T13:00:00Z", title: "Film outro" });
    expect(syncPlan([t], [link], new Map([["e1", event()]]), TZ, true)).toEqual([{ op: "update-event", task: t, eventId: "e1" }]);
  });

  test("moved in Google since the last sync: update the task", () => {
    const e = event({ updated: "2026-11-28T13:00:00Z", start: { dateTime: "2026-11-30T16:00:00Z" }, end: { dateTime: "2026-11-30T17:30:00Z" } });
    expect(syncPlan([task()], [link], new Map([["e1", e]]), TZ, true)).toEqual([{ op: "update-task", task: task(), eventId: "e1", patch: { due_time: "16:00" } }]);
  });

  test("changed on both sides: the later change wins", () => {
    const t = task({ updated_at: "2026-11-28T13:00:00Z", title: "Nox title" });
    const later = event({ updated: "2026-11-28T14:00:00Z", summary: "Google title" });
    const earlier = event({ updated: "2026-11-28T12:30:00Z", summary: "Google title" });
    expect(syncPlan([t], [link], new Map([["e1", later]]), TZ, true)[0]).toMatchObject({ op: "update-task", patch: { title: "Google title" } });
    expect(syncPlan([t], [link], new Map([["e1", earlier]]), TZ, true)[0]).toMatchObject({ op: "update-event" });
  });

  test("task deleted or untimed in Nox: delete the event", () => {
    expect(syncPlan([task({ deleted: true })], [link], new Map([["e1", event()]]), TZ, true)).toEqual([{ op: "delete-event", taskId: "t1", eventId: "e1" }]);
    expect(syncPlan([], [link], new Map([["e1", event()]]), TZ, true)).toEqual([{ op: "delete-event", taskId: "t1", eventId: "e1" }]);
  });

  test("event deleted in Google: the task comes off the calendar (keeps its day)", () => {
    expect(syncPlan([task()], [link], new Map([["e1", null]]), TZ, true)).toEqual([{ op: "untime-task", taskId: "t1", eventId: "e1" }]);
    expect(syncPlan([task()], [link], new Map([["e1", event({ status: "cancelled" })]]), TZ, true)).toEqual([{ op: "untime-task", taskId: "t1", eventId: "e1" }]);
  });

  test("both gone: just forget the pair; nothing changed: nothing to do", () => {
    expect(syncPlan([], [link], new Map([["e1", null]]), TZ, true)).toEqual([{ op: "noop-link", taskId: "t1", eventId: "e1" }]);
    expect(syncPlan([task()], [link], new Map([["e1", event()]]), TZ, true)).toEqual([]);
  });
});

describe("eventForApp", () => {
  test("other events show as busy; Nox's own and cancelled ones don't; only https links", () => {
    expect(eventForApp({ id: "a", summary: "Standup", htmlLink: "https://calendar.google.com/x", start: { dateTime: "2026-11-30T09:00:00Z" }, end: { dateTime: "2026-11-30T09:15:00Z" } })).toEqual({
      id: "a",
      title: "Standup",
      start: "2026-11-30T09:00:00Z",
      end: "2026-11-30T09:15:00Z",
      allDay: false,
      link: "https://calendar.google.com/x",
    });
    expect(eventForApp({ id: "b", extendedProperties: { private: { noxTaskId: "t" } }, start: { dateTime: "x" }, end: { dateTime: "y" } })).toBeNull();
    expect(eventForApp({ id: "c", status: "cancelled", start: { dateTime: "x" }, end: { dateTime: "y" } })).toBeNull();
    expect(eventForApp({ id: "d", htmlLink: "javascript:x", start: { date: "2026-11-30" }, end: { date: "2026-12-01" } })).toMatchObject({ allDay: true, link: null, title: "Busy" });
  });
});
