import { describe, expect, test } from "bun:test";
import { brainDumpTasks, DUMP_LIMIT, splitBrainDump } from "./brain-dump";

const TODAY = "2026-11-28"; // a Saturday

describe("splitBrainDump", () => {
  test("lines, sentences and 'and then' each become a part", () => {
    expect(splitBrainDump("Call mum tomorrow. Buy milk and then pick up the parcel\nemail Sam about the invoice; book dentist")).toEqual([
      "Call mum tomorrow",
      "Buy milk",
      "pick up the parcel",
      "email Sam about the invoice",
      "book dentist",
    ]);
  });

  test("drops what people say before the actual thing", () => {
    expect(splitBrainDump("I need to call mum. Also I have to renew the passport, then don't forget to water plants")).toEqual([
      "call mum",
      "renew the passport",
      "water plants",
    ]);
  });

  test("ignores empty bits and bullets, and stops at the limit", () => {
    expect(splitBrainDump("- one\n\n• two\n.\n")).toEqual(["one", "two"]);
    expect(splitBrainDump(Array.from({ length: 50 }, (_, i) => `task ${i}`).join("\n"))).toHaveLength(DUMP_LIMIT);
  });

  test("keeps 'and' inside a task", () => {
    expect(splitBrainDump("Buy bread and butter")).toEqual(["Buy bread and butter"]);
  });
});

describe("brainDumpTasks", () => {
  test("reads days, times and priority like quick add", () => {
    const tasks = brainDumpTasks("call mum monday 6pm. renew passport !high\nwater plants", TODAY);
    expect(tasks).toEqual([
      { title: "Call mum", date: "2026-11-30", time: "18:00", minutes: null, priority: "medium" },
      { title: "Renew passport", date: null, time: null, minutes: null, priority: "high" },
      { title: "Water plants", date: null, time: null, minutes: null, priority: "medium" },
    ]);
  });
});
