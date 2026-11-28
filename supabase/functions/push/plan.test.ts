import { describe, expect, test } from "bun:test";
import { DEFAULT_PREFS, dueKinds, localClock, messages, readPrefs } from "./plan";

describe("readPrefs", () => {
  test("defaults, and bad values fall back", () => {
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(readPrefs({ morning: false, hour: 6 })).toEqual({ ...DEFAULT_PREFS, morning: false, hour: 6 });
    expect(readPrefs({ hour: 25 }).hour).toBe(8);
    expect(readPrefs({ hour: "7" }).hour).toBe(7);
    expect(readPrefs({ hour: 7.5 }).hour).toBe(8);
  });
});

describe("localClock", () => {
  const now = new Date("2026-11-28T23:30:00Z");
  test("the local day and hour in a time zone", () => {
    expect(localClock(now, "UTC")).toEqual({ day: "2026-11-28", hour: 23, tz: "UTC" });
    expect(localClock(now, "Asia/Kolkata")).toEqual({ day: "2026-11-29", hour: 5, tz: "Asia/Kolkata" });
    expect(localClock(now, "America/New_York")).toEqual({ day: "2026-11-28", hour: 18, tz: "America/New_York" });
  });
  test("an unknown zone is read as UTC", () => {
    expect(localClock(now, "Mars/Olympus")).toEqual({ day: "2026-11-28", hour: 23, tz: "UTC" });
  });
  test("midnight is hour 0, not 24", () => {
    expect(localClock(new Date("2026-11-28T00:10:00Z"), "UTC").hour).toBe(0);
  });
});

describe("dueKinds", () => {
  test("each kind at its own local hour, when switched on", () => {
    expect(dueKinds(DEFAULT_PREFS, 8)).toEqual(["morning"]);
    expect(dueKinds(DEFAULT_PREFS, 9)).toEqual(["deadlines"]);
    expect(dueKinds(DEFAULT_PREFS, 17)).toEqual(["overdue"]);
    expect(dueKinds(DEFAULT_PREFS, 12)).toEqual([]);
    expect(dueKinds({ ...DEFAULT_PREFS, hour: 9 }, 9)).toEqual(["morning", "deadlines"]);
    expect(dueKinds({ ...DEFAULT_PREFS, overdue: false }, 17)).toEqual([]);
  });
});

describe("messages", () => {
  test("counts only, never titles; nothing to say → nothing sent", () => {
    expect(messages(["morning"], { today: 3, overdue: 1, deadlines: 0 })).toEqual([
      { kind: "morning", title: "Good morning", body: "3 tasks today · 1 overdue. Open Nox to plan your day.", url: "/tasks" },
    ]);
    expect(messages(["morning"], { today: 1, overdue: 0, deadlines: 0 })[0]!.body).toBe("1 task today. Open Nox to plan your day.");
    expect(messages(["morning", "overdue", "deadlines"], { today: 0, overdue: 0, deadlines: 0 })).toEqual([]);
  });

  test("overdue and deadlines", () => {
    expect(messages(["overdue"], { today: 0, overdue: 1, deadlines: 0 })[0]!.title).toBe("1 task is overdue");
    expect(messages(["overdue"], { today: 0, overdue: 4, deadlines: 0 })[0]!.title).toBe("4 tasks are overdue");
    expect(messages(["deadlines"], { today: 0, overdue: 0, deadlines: 2 })[0]).toEqual({ kind: "deadlines", title: "A deadline is close", body: "2 spaces are due within 2 days.", url: "/spaces" });
  });
});
