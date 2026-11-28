import { describe, expect, test } from "bun:test";
import type { Idea, Note, Resource, Task } from "@nox/types";
import { belongsInInbox, inboxItems, withInboxExit } from "./inbox";

const base = { user_id: "u", updated_at: "2026-01-01T00:00:00Z", deleted: false };
const task = (id: string, created: string, p: Partial<Task> = {}): Task => ({
  ...base,
  id,
  created_at: created,
  title: id,
  notes: null,
  due_date: null,
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
  inbox: true,
  ...p,
});
const note = (id: string, created: string, p: Partial<Note> = {}): Note => ({
  ...base,
  id,
  created_at: created,
  title: null,
  type: "text",
  content: [{ type: "paragraph", text: `body of ${id}` }],
  folder_id: null,
  tags: [],
  is_pinned: false,
  is_archived: false,
  space_id: null,
  properties: [],
  stage: null,
  inbox: true,
  ...p,
});
const idea = (id: string, created: string, p: Partial<Idea> = {}): Idea =>
  ({ ...base, id, created_at: created, title: id, description: null, content: [], priority: "medium", status: "raw", tags: [], is_archived: false, space_id: null, properties: [], stage: null, inbox: true, ...p }) as Idea;
const link = (id: string, created: string, p: Partial<Resource> = {}): Resource => ({
  ...base,
  id,
  created_at: created,
  type: "link",
  url: `https://${id}.com/x`,
  title: null,
  domain: `${id}.com`,
  thumbnail_url: null,
  duration: null,
  body: null,
  tag_ids: [],
  is_archived: false,
  space_id: null,
  inbox: true,
  ...p,
});

describe("inboxItems", () => {
  test("lists every kind that's marked inbox, newest first", () => {
    const items = inboxItems({
      tasks: [task("t1", "2026-11-20T09:00:00Z")],
      notes: [note("n1", "2026-11-22T09:00:00Z")],
      ideas: [idea("i1", "2026-11-21T09:00:00Z")],
      resources: [link("r1", "2026-11-23T09:00:00Z")],
    });
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual(["resource:r1", "note:n1", "idea:i1", "task:t1"]);
  });

  test("titles fall back sensibly: a note's first line, a link's domain", () => {
    const items = inboxItems({ tasks: [], notes: [note("n1", "2026-11-22T09:00:00Z")], ideas: [], resources: [link("r1", "2026-11-23T09:00:00Z")] });
    expect(items.map((i) => i.title)).toEqual(["r1.com", "body of n1"]);
  });

  test("leaves out what's sorted, done, deleted, archived or dropped", () => {
    const at = "2026-11-20T09:00:00Z";
    const items = inboxItems({
      tasks: [task("sorted", at, { inbox: false }), task("done", at, { status: "complete" }), task("gone", at, { deleted: true }), task("keep", at)],
      notes: [note("archived", at, { is_archived: true })],
      ideas: [idea("dropped", at, { status: "dropped" })],
      resources: [link("archived-link", at, { is_archived: true })],
    });
    expect(items.map((i) => i.id)).toEqual(["keep"]);
  });

  test("same creation time: a stable order by id", () => {
    const at = "2026-11-20T09:00:00Z";
    const items = inboxItems({ tasks: [task("b", at), task("a", at)], notes: [], ideas: [], resources: [] });
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("belongsInInbox", () => {
  test("only captures with no space and no day", () => {
    expect(belongsInInbox({ spaceId: null })).toBe(true);
    expect(belongsInInbox({ spaceId: null, date: null })).toBe(true);
    expect(belongsInInbox({ spaceId: "s" })).toBe(false);
    expect(belongsInInbox({ spaceId: null, date: "2026-11-28" })).toBe(false);
  });
});

describe("withInboxExit", () => {
  const keys = ["due_date", "space_id"] as const;
  test("giving an Inbox item a day or a space takes it out", () => {
    expect(withInboxExit({ inbox: true }, { id: "t", patch: { due_date: "2026-11-28" } as object }, keys).patch).toEqual({ due_date: "2026-11-28", inbox: false });
    expect(withInboxExit({ inbox: true }, { id: "t", patch: { space_id: "s" } as object }, keys).patch).toEqual({ space_id: "s", inbox: false });
  });

  test("other edits, or clearing a day, leave it in", () => {
    const v = { id: "t", patch: { title: "x", due_date: null } };
    expect(withInboxExit({ inbox: true }, v, keys)).toBe(v);
  });

  test("items not in the Inbox are never sent the flag", () => {
    const v = { id: "t", patch: { due_date: "2026-11-28" } };
    expect(withInboxExit({ inbox: false }, v, keys)).toBe(v);
    expect(withInboxExit(undefined, v, keys)).toBe(v);
  });

  test("an explicit inbox value is respected", () => {
    const v = { id: "t", patch: { space_id: "s", inbox: true } };
    expect(withInboxExit({ inbox: true }, v, keys)).toBe(v);
  });
});
