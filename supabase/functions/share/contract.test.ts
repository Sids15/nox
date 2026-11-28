import { describe, expect, test } from "bun:test";
import { sharedView } from "../../../packages/types/src/share";
import { viewIdea, viewNote, viewSpace } from "./view";

// The app reads what this function sends with `sharedView`: every shape it sends must parse.
describe("share function ↔ app contract", () => {
  test("a note, an idea and a space all parse", () => {
    const note = viewNote({ title: "Plan", content: [{ type: "heading", text: "A", level: 1 }, { type: "paragraph", text: "b" }, { type: "link", url: "https://x.com", title: null }], updated_at: "2026-11-28T10:00:00Z" });
    const idea = viewIdea({ title: "Hook", status: "raw", description: null, content: [], updated_at: "2026-11-28T10:00:00Z" });
    const space = viewSpace(
      { name: "Launch", icon: "", description: null, due_date: null, updated_at: "2026-11-28T10:00:00Z" },
      [{ title: "t", status: "pending", due_date: "2026-12-01", repeat: "none", origin_task_id: null }],
      [{ title: "n", content: [] }],
      [{ title: "i", status: "raw" }],
    );
    for (const v of [note, idea, space]) expect(sharedView.safeParse(JSON.parse(JSON.stringify(v))).success).toBe(true);
  });
});
