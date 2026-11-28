import { describe, expect, test } from "bun:test";
import type { Idea, Note, Resource, Space, Task } from "@nox/types";
import { duplicateSpace } from "./duplicate";

const base = { user_id: "u", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", deleted: false };
const space: Space = { ...base, id: "s1", name: "Video 12", icon: "🎬", color: "", description: "Ship by Friday", stages: [], position: 0, archived: false, due_date: "2026-12-01" };
const task = (id: string, p: Partial<Task> = {}): Task => ({
  ...base,
  id,
  title: id,
  notes: null,
  due_date: "2026-11-30",
  due_time: "10:00",
  reminder_times: ["2026-11-30T09:00:00Z"],
  priority: "high",
  status: "complete",
  repeat: "none",
  repeat_config: null,
  origin_task_id: null,
  sort_order: 0,
  streak_count: 0,
  longest_streak: 0,
  last_completed_on: null,
  space_id: "s1",
  inbox: false,
  ...p,
});
const note = (id: string, p: Partial<Note> = {}): Note => ({
  ...base,
  id,
  title: id,
  type: "mixed",
  content: [{ type: "paragraph", text: "script" }, { type: "image", storagePath: "u/a.png" } as Note["content"][number]],
  folder_id: null,
  tags: ["yt"],
  is_pinned: true,
  is_archived: false,
  space_id: "s1",
  properties: [],
  stage: null,
  inbox: false,
  ...p,
});

describe("duplicateSpace", () => {
  const copy = duplicateSpace(space, {
    tasks: [
      task("film", { sort_order: 1, duration_minutes: 90 }),
      task("script", { sort_order: 0 }),
      task("other space", { space_id: "s2" }),
      task("deleted", { deleted: true }),
      task("weekly upload", { repeat: "weekly", origin_task_id: null, sort_order: 2 }),
      task("an occurrence", { repeat: "weekly", origin_task_id: "tpl" }),
    ],
    notes: [note("outline"), note("archived", { is_archived: true })],
    ideas: [{ ...base, id: "i1", title: "Hook", description: null, content: [], priority: "low", status: "validating", tags: [], is_archived: false, space_id: "s1", properties: [], stage: null, inbox: false } as Idea],
    resources: [
      { ...base, id: "r1", type: "link", url: "https://a.com", title: "Ref", domain: "a.com", thumbnail_url: null, duration: null, body: null, tag_ids: [], is_archived: false, space_id: "s1", inbox: false } as Resource,
      { ...base, id: "r2", type: "image", url: null, title: null, domain: null, thumbnail_url: null, duration: null, body: null, tag_ids: [], is_archived: false, space_id: "s1", inbox: false } as Resource,
    ],
  });

  test("the space: name + copy, same mark and goal, no deadline", () => {
    expect(copy.space).toMatchObject({ name: "Video 12 copy", icon: "🎬", description: "Ship by Friday", due_date: null, archived: false });
  });

  test("tasks start fresh: in order, open, no day, time or reminders; repeating rules kept once", () => {
    expect(copy.tasks.map((t) => t.title)).toEqual(["script", "film", "weekly upload"]);
    expect(copy.tasks[1]).toEqual({ title: "film", notes: null, due_date: null, due_time: null, duration_minutes: 90, reminder_times: [], priority: "high", repeat: "none", repeat_config: null });
    expect(copy.tasks[2]!.repeat).toBe("weekly");
  });

  test("notes and ideas keep their words but not stored media; ideas start raw", () => {
    expect(copy.notes).toHaveLength(1);
    expect(copy.notes[0]!.content).toEqual([{ type: "paragraph", text: "script" }]);
    expect(copy.ideas[0]).toMatchObject({ title: "Hook", status: "raw", priority: "low" });
  });

  test("links come along; uploaded pictures are counted as left out", () => {
    expect(copy.resources.map((r) => r.url)).toEqual(["https://a.com"]);
    expect(copy.mediaLeftOut).toBe(2);
  });

  test("a long name stays within 80 characters", () => {
    expect(duplicateSpace({ ...space, name: "x".repeat(80) }, { tasks: [], notes: [], ideas: [], resources: [] }).space.name).toHaveLength(80);
  });
});
