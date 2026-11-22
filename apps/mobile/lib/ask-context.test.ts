import { describe, expect, test } from "bun:test";
import { rankContext, terms, type AskItem } from "./ask-context";

const items: AskItem[] = [
  { id: "a", kind: "note", title: "Pricing thoughts", text: "Charge per seat, maybe a free tier." },
  { id: "b", kind: "idea", title: "Rust desktop app", text: "Move the sync engine to Rust." },
  { id: "c", kind: "task", title: "Call the dentist", text: "" },
  { id: "d", kind: "resource", title: "Seat-based pricing guide", text: "How SaaS companies price per seat." },
];

describe("terms", () => {
  test("drops filler and short words, keeps numbers", () => {
    expect(terms("What did I write about pricing in 2026?")).toEqual(["write", "pricing", "2026"]);
  });
});

describe("rankContext", () => {
  test("title matches beat body matches, unrelated items are left out", () => {
    expect(rankContext("what did I write about pricing", items).map((i) => i.id)).toEqual(["a", "d"]);
  });

  test("a longer form of a word still matches; an unrelated one doesn't", () => {
    expect(rankContext("rusting", items).map((i) => i.id)).toEqual([]);
    expect(rankContext("dentists", items).map((i) => i.id)).toEqual(["c"]);
  });

  test("respects the limit and cuts long text", () => {
    const long = { id: "x", kind: "note" as const, title: "pricing", text: "pricing ".repeat(500) };
    const out = rankContext("pricing", [long, ...items], 2, 50);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe("x");
    expect(out[0]!.text.length).toBeLessThanOrEqual(50);
  });

  test("a question with no real words sends nothing", () => {
    expect(rankContext("what is it?", items)).toEqual([]);
  });
});
