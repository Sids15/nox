import { describe, expect, test } from "bun:test";
import { isToken, MAX_TASKS, textBlocks, viewIdea, viewNote, viewSpace } from "./view";

describe("textBlocks", () => {
  test("keeps words and web links; drops stored media, unknown blocks and unsafe links", () => {
    expect(
      textBlocks([
        { type: "heading", text: "Plan", level: 2 },
        { type: "paragraph", text: "Hello" },
        { type: "image", storagePath: "user-id/secret.png" },
        { type: "audio", storagePath: "user-id/memo.m4a" },
        { type: "sketch", storagePath: "user-id/s.png" },
        { type: "link", url: "https://example.com", title: "Ex", extra: "x" },
        { type: "link", url: "javascript:alert(1)", title: "bad" },
        { type: "script", text: "<b>" },
        null,
        "text",
      ]),
    ).toEqual([
      { type: "heading", text: "Plan", level: 2 },
      { type: "paragraph", text: "Hello" },
      { type: "link", url: "https://example.com", title: "Ex" },
    ]);
  });

  test("not a list: nothing", () => {
    expect(textBlocks({ type: "paragraph" })).toEqual([]);
  });
});

describe("viewNote / viewIdea", () => {
  const row = { id: "n1", user_id: "owner", title: "", content: [{ type: "paragraph", text: "First line" }], tags: ["private"], folder_id: "f", properties: [{ name: "Owner" }], updated_at: "2026-11-28T10:00:00Z" };

  test("a note: its title (or first line) and text, nothing about the account", () => {
    const v = viewNote(row);
    expect(v).toEqual({ kind: "note", title: "First line", status: null, description: null, blocks: [{ type: "paragraph", text: "First line" }], updated_at: "2026-11-28T10:00:00Z" });
    expect(JSON.stringify(v)).not.toContain("owner");
    expect(JSON.stringify(v)).not.toContain("private");
  });

  test("an idea: title, status, description and text", () => {
    expect(viewIdea({ title: "Hook", status: "exploring", description: "Why", content: [], user_id: "owner" })).toMatchObject({ kind: "idea", title: "Hook", status: "exploring", description: "Why" });
  });
});

describe("viewSpace", () => {
  const space = { id: "s", user_id: "owner", name: "Launch", icon: "🚀", description: "Ship v1.2", due_date: "2026-12-15", updated_at: "2026-11-28T10:00:00Z" };

  test("open tasks first, then done; templates, deleted and archived things left out", () => {
    const v = viewSpace(
      space,
      [
        { title: "done one", status: "complete", due_date: "2026-11-01", repeat: "none", origin_task_id: null, notes: "secret" },
        { title: "later", status: "pending", due_date: "2026-12-10", repeat: "none", origin_task_id: null },
        { title: "soon", status: "pending", due_date: "2026-12-01", repeat: "none", origin_task_id: null },
        { title: "rule", status: "pending", due_date: null, repeat: "weekly", origin_task_id: null },
        { title: "gone", status: "pending", due_date: null, repeat: "none", origin_task_id: null, deleted: true },
      ],
      [{ title: "Brief", content: [] }, { title: "old", is_archived: true }],
      [{ title: "Idea", status: "raw" }, { title: "nope", status: "dropped" }],
    );
    expect(v.tasks).toEqual([
      { title: "soon", done: false, due_date: "2026-12-01" },
      { title: "later", done: false, due_date: "2026-12-10" },
      { title: "done one", done: true, due_date: "2026-11-01" },
    ]);
    expect(v.pages).toEqual([
      { kind: "note", title: "Brief" },
      { kind: "idea", title: "Idea" },
    ]);
    expect(v).toMatchObject({ kind: "space", name: "Launch", icon: "🚀", goal: "Ship v1.2", due_date: "2026-12-15" });
    // Task notes never leave.
    expect(JSON.stringify(v)).not.toContain("secret");
    expect(JSON.stringify(v)).not.toContain("owner");
  });

  test("caps how much one link can show", () => {
    const many = Array.from({ length: MAX_TASKS + 50 }, (_, i) => ({ title: `t${i}`, status: "pending", due_date: null, repeat: "none", origin_task_id: null }));
    expect(viewSpace(space, many, [], []).tasks).toHaveLength(MAX_TASKS);
  });
});

describe("isToken", () => {
  test("64 lower-case hex characters only", () => {
    expect(isToken("a".repeat(64))).toBe(true);
    expect(isToken("A".repeat(64))).toBe(false);
    expect(isToken("a".repeat(63))).toBe(false);
    expect(isToken("' or 1=1 --".padEnd(64, "a"))).toBe(false);
    expect(isToken(null)).toBe(false);
  });
});
