import { describe, expect, test } from "bun:test";
import type { Note, Space, Task } from "@nox/types";
import { DEFAULT_WIDGET, buildWidgetSnapshot, normalizeWidgetConfig } from "./widget";

const base = { user_id: "u", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted: false };
const task = (id: string, p: Partial<Task>): Task => ({
  ...base,
  id,
  title: id,
  notes: null,
  due_date: "2026-11-25",
  due_time: null,
  reminder_times: [],
  priority: "medium",
  status: "pending",
  repeat: "none",
  repeat_config: null,
  origin_task_id: null,
  sort_order: 0,
  streak_count: 0,
  longest_streak: 0,
  last_completed_on: null,
  space_id: null,
  inbox: false,
  ...p,
});
const note = (id: string, p: Partial<Note>): Note => ({
  ...base,
  id,
  title: id,
  type: "text",
  content: [],
  folder_id: null,
  tags: [],
  is_pinned: false,
  is_archived: false,
  space_id: null,
  inbox: false,
  properties: [],
  stage: null,
  ...p,
});

describe("widget config", () => {
  test("fills in missing sections, drops unknown ones and clamps limits", () => {
    const c = normalizeWidgetConfig({ sections: [{ key: "pinned", on: true }, { key: "bogus" as never, on: true }], maxItems: 99 });
    expect(c.sections.map((s) => s.key)).toEqual(["pinned", "today", "next", "capture", "space"]);
    expect(c.sections[0]!.on).toBe(true);
    expect(c.sections[1]!.on).toBe(false);
    expect(c.maxItems).toBe(8);
    expect(normalizeWidgetConfig(null)).toEqual(DEFAULT_WIDGET);
  });
});

describe("widget snapshot", () => {
  const tasks = [
    task("late", { due_time: "18:00:00" }),
    task("early", { due_time: "09:00:00" }),
    task("done", { status: "complete" }),
    task("undated", { due_date: null }),
    task("tomorrow", { due_date: "2026-11-26" }),
    task("template", { repeat: "daily" }),
  ];

  test("today: open first by time, done last, templates and other days left out", () => {
    const s = buildWidgetSnapshot({ tasks, notes: [], ideas: [], spaces: [], config: DEFAULT_WIDGET }, "2026-11-25", "12:00", "x");
    const today = s.sections[0]!;
    expect(today.kind).toBe("today");
    if (today.kind !== "today") return;
    expect(today.items.map((i) => i.id)).toEqual(["early", "late", "undated", "done"]);
    expect(today.total).toBe(4);
    expect(today.done).toBe(1);
  });

  test("up next: only later today, by time", () => {
    const s = buildWidgetSnapshot({ tasks, notes: [], ideas: [], spaces: [], config: DEFAULT_WIDGET }, "2026-11-25", "12:00", "x");
    const next = s.sections[1]!;
    expect(next.kind === "next" && next.items.map((i) => i.id)).toEqual(["late"]);
  });

  test("hidden done tasks, item limit and the 'more' count", () => {
    const config = { ...DEFAULT_WIDGET, showDone: false, maxItems: 3 };
    const many = [...tasks, task("a", {}), task("b", {})];
    const s = buildWidgetSnapshot({ tasks: many, notes: [], ideas: [], spaces: [], config }, "2026-11-25", "12:00", "x");
    const today = s.sections[0]!;
    if (today.kind !== "today") throw new Error("expected today");
    expect(today.items).toHaveLength(3);
    expect(today.items.some((i) => i.done)).toBe(false);
    expect(today.more).toBe(2);
  });

  test("space pipeline counts pages per stage; pinned notes listed", () => {
    const space: Space = { ...base, id: "s1", name: "Tech", icon: "🎬", color: "", description: null, stages: ["Idea", "Script"], position: 0, archived: false, due_date: null };
    const notes = [note("n1", { space_id: "s1", stage: "Idea" }), note("n2", { space_id: "s1", stage: "Idea" }), note("n3", { is_pinned: true })];
    const config = { ...DEFAULT_WIDGET, sections: [{ key: "space" as const, on: true }, { key: "pinned" as const, on: true }] };
    const s = buildWidgetSnapshot({ tasks: [], notes, ideas: [], spaces: [space], config }, "2026-11-25", "12:00", "x");
    expect(s.sections[0]).toEqual({ kind: "space", spaceId: "s1", name: "Tech", icon: "🎬", pages: 2 });
    expect(s.sections[1]).toEqual({ kind: "pinned", items: [{ id: "n3", title: "n3" }] });
  });
});
