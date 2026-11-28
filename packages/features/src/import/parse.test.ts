import { describe, expect, test } from "bun:test";
import { detectFormat, fromNotion, fromText, fromTickTick, fromTodoist, parseCsv, parseDate, parseImport } from "./parse";

describe("parseCsv", () => {
  test("quotes, doubled quotes, commas and newlines inside quotes, CRLF, BOM", () => {
    const csv = '﻿a,b,c\r\n"x, y","say ""hi""","line 1\nline 2"\r\n\r\n1,,3';
    expect(parseCsv(csv)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "line 1\nline 2"],
      ["1", "", "3"],
    ]);
  });
});

describe("parseDate", () => {
  test("ISO days and times", () => {
    expect(parseDate("2026-11-30")).toEqual({ date: "2026-11-30", time: null });
    expect(parseDate("2026-11-30 14:05")).toEqual({ date: "2026-11-30", time: "14:05" });
  });

  test("written dates, with or without a time", () => {
    expect(parseDate("Nov 30 2026")).toEqual({ date: "2026-11-30", time: null });
    expect(parseDate("November 30, 2026")).toEqual({ date: "2026-11-30", time: null });
    expect(parseDate("30 Nov 2026 2pm")).toEqual({ date: "2026-11-30", time: "14:00" });
    expect(parseDate("Dec 1st 2026 12:30am")).toEqual({ date: "2026-12-01", time: "00:30" });
  });

  test("an all-day timestamp (midnight UTC) keeps its day and has no time", () => {
    expect(parseDate("2026-11-30T00:00:00+0000")).toEqual({ date: "2026-11-30", time: null });
    expect(parseDate("2026-11-30T00:00:00.000Z")).toEqual({ date: "2026-11-30", time: null });
  });

  test("a timestamp with a time is read in the local time zone", () => {
    const local = new Date("2026-11-30T14:00:00Z");
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(parseDate("2026-11-30T14:00:00+0000")).toEqual({
      date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
      time: `${pad(local.getHours())}:${pad(local.getMinutes())}`,
    });
  });

  test("impossible or relative dates are null", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("every monday")).toBeNull();
    expect(parseDate("tomorrow")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("fromTodoist", () => {
  const csv = [
    "TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT",
    "task,Plan launch,,1,1,Me,,2026-12-01,en,UTC,,",
    "section,Marketing,,,,,,,,,,",
    'task,"Write post, draft",Outline first,3,1,Me,,every monday,en,UTC,,',
    "note,Just a comment,,,,,,,,,,",
    "task,,,4,1,Me,,,en,UTC,,",
  ].join("\n");

  test("tasks with their day, priority, section and description", () => {
    const r = fromTodoist(csv);
    expect(r.format).toBe("todoist");
    expect(r.tasks).toEqual([
      { title: "Plan launch", notes: null, due_date: "2026-12-01", due_time: null, priority: "high", done: false, list: null },
      { title: "Write post, draft", notes: "Outline first\nTodoist date: every monday", due_date: null, due_time: null, priority: "medium", done: false, list: "Marketing" },
    ]);
    // The comment row and the empty task.
    expect(r.skipped).toBe(2);
  });
});

describe("fromTickTick", () => {
  const csv = [
    '"Date: 2026-11-28+0000"',
    '"Version: 7.1"',
    '"Status: \n0 Normal\n1 Completed\n2 Archived"',
    '"Folder Name","List Name","Title","Kind","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day"',
    '"Work","Launch","Ship v1.2","TEXT","","Release notes","N","","2026-12-02T00:00:00+0000","","","5","0","","","0","UTC","true"',
    '"","Home","Water plants","TEXT","","","N","","","","FREQ=WEEKLY","1","2","","","0","UTC",""',
    '"","Home","A note","NOTE","","","N","","","","","0","0","","","0","UTC",""',
  ].join("\n");

  test("skips the preamble, reads day, priority, status and list; notes are skipped", () => {
    const r = fromTickTick(csv);
    expect(r.tasks).toEqual([
      { title: "Ship v1.2", notes: "Release notes", due_date: "2026-12-02", due_time: null, priority: "high", done: false, list: "Launch" },
      { title: "Water plants", notes: "Repeats: FREQ=WEEKLY", due_date: null, due_time: null, priority: "low", done: true, list: "Home" },
    ]);
    expect(r.skipped).toBe(1);
  });
});

describe("fromNotion", () => {
  const csv = [
    "Name,Status,Due date,Priority,Project,Owner",
    "Design review,Done,\"November 30, 2026\",High,Launch,Sam",
    "Write docs,In progress,\"December 2, 2026 → December 4, 2026\",Low,\"Docs, Launch\",",
    ",Not started,,,,",
  ].join("\n");

  test("title from the first column; date, status, priority, list; other columns to notes", () => {
    const r = fromNotion(csv);
    expect(r.tasks).toEqual([
      { title: "Design review", notes: "Owner: Sam", due_date: "2026-11-30", due_time: null, priority: "high", done: true, list: "Launch" },
      { title: "Write docs", notes: null, due_date: "2026-12-02", due_time: null, priority: "low", done: false, list: "Docs" },
    ]);
    expect(r.skipped).toBe(1);
  });
});

describe("fromText", () => {
  test("checklists, bullets, numbers and headings", () => {
    const r = fromText("# Groceries\n- [ ] Milk\n- [x] Eggs\n\n* Bread\n2. Butter\nJust a line\n- [ ]   \n## Errands\nPost office");
    expect(r.tasks.map((t) => [t.title, t.done, t.list])).toEqual([
      ["Milk", false, "Groceries"],
      ["Eggs", true, "Groceries"],
      ["Bread", false, "Groceries"],
      ["Butter", false, "Groceries"],
      ["Just a line", false, "Groceries"],
      ["Post office", false, "Errands"],
    ]);
    // Two headings and the empty checkbox.
    expect(r.skipped).toBe(3);
  });
});

describe("detectFormat / parseImport", () => {
  test("recognises each export by its header", () => {
    expect(detectFormat("TYPE,CONTENT,PRIORITY\ntask,x,1")).toBe("todoist");
    expect(detectFormat('"Date: x"\n"Folder Name","List Name","Title"')).toBe("ticktick");
    expect(detectFormat("Name,Status\nA,Done")).toBe("notion");
    expect(detectFormat("Buy milk, eggs and bread\nCall mum")).toBe("text");
    expect(detectFormat("- [ ] a\n- [ ] b")).toBe("text");
  });

  test("parseImport uses the detected reader", () => {
    expect(parseImport("Name,Status\nA,Done").tasks[0]).toMatchObject({ title: "A", done: true });
    expect(parseImport("one\ntwo").tasks.map((t) => t.title)).toEqual(["one", "two"]);
  });
});
