import { describe, expect, test } from "bun:test";
import { parseQuickAdd } from "./parse-quick-add";

// Saturday, 14 Nov 2026.
const TODAY = "2026-11-14";
const p = (s: string) => parseQuickAdd(s, TODAY);

describe("parseQuickAdd — dates", () => {
  test("today / tomorrow / tmrw", () => {
    expect(p("Call mum today")).toMatchObject({ title: "Call mum", date: "2026-11-14" });
    expect(p("Call mum tomorrow")).toMatchObject({ title: "Call mum", date: "2026-11-15" });
    expect(p("tmrw pay rent")).toMatchObject({ title: "pay rent", date: "2026-11-15" });
  });

  test("weekday names go to the next occurrence, today included", () => {
    expect(p("Gym monday").date).toBe("2026-11-16");
    expect(p("Brunch saturday").date).toBe("2026-11-14");
    expect(p("Gym on fri").date).toBe("2026-11-20");
    expect(p("Review next wed").date).toBe("2026-11-18");
  });

  test("next week, in N days/weeks", () => {
    expect(p("Plan sprint next week").date).toBe("2026-11-16");
    expect(p("Renew in 3 days").date).toBe("2026-11-17");
    expect(p("Dentist in 2 weeks").date).toBe("2026-11-28");
  });

  test("month + day, either order, rolling into next year once passed", () => {
    expect(p("Party Nov 21").date).toBe("2026-11-21");
    expect(p("Party 21st November").date).toBe("2026-11-21");
    expect(p("Taxes march 3").date).toBe("2027-03-03");
    expect(p("Bad date feb 30").date).toBeUndefined();
  });

  test("tonight is 8 PM unless a time is given", () => {
    expect(p("Read tonight")).toMatchObject({ title: "Read", date: TODAY, time: "20:00" });
    expect(p("Read tonight at 10pm")).toMatchObject({ title: "Read", date: TODAY, time: "22:00" });
  });
});

describe("parseQuickAdd — times", () => {
  test("12-hour, 24-hour, noon", () => {
    expect(p("Call 6pm").time).toBe("18:00");
    expect(p("Call at 6:30 pm").time).toBe("18:30");
    expect(p("Call 9am").time).toBe("09:00");
    expect(p("Call 12am").time).toBe("00:00");
    expect(p("Standup at 09:15").time).toBe("09:15");
    expect(p("Lunch noon").time).toBe("12:00");
  });

  test("a time on its own does not invent a date", () => {
    expect(p("Call 6pm").date).toBeUndefined();
  });
});

describe("parseQuickAdd — priority and repeat", () => {
  test("priority shortcuts", () => {
    expect(p("Fix bug !high").priority).toBe("high");
    expect(p("Fix bug !1").priority).toBe("high");
    expect(p("Fix bug p2").priority).toBe("medium");
    expect(p("Fix bug !l").priority).toBe("low");
  });

  test("repeat rules anchor a date when none is given", () => {
    expect(p("Stretch daily")).toMatchObject({ title: "Stretch", repeat: { kind: "daily" }, date: TODAY });
    // Saturday → the next weekday is Monday.
    expect(p("Standup every weekday")).toMatchObject({ repeat: { kind: "weekdays" }, date: "2026-11-16" });
    expect(p("Bins every mon and thu")).toMatchObject({
      title: "Bins",
      repeat: { kind: "custom", weekdays: [1, 4] },
      date: "2026-11-16",
    });
  });
});

describe("parseQuickAdd — the whole line, and what it leaves alone", () => {
  test("everything at once", () => {
    const r = p("Call mum tomorrow at 6pm !high");
    expect(r).toMatchObject({ title: "Call mum", date: "2026-11-15", time: "18:00", priority: "high" });
    expect(r.matched.map((m) => m.field)).toEqual(["date", "time", "priority"]);
  });

  test("plain titles pass through untouched", () => {
    expect(p("Buy milk")).toEqual({ title: "Buy milk", matched: [] });
  });

  test("whole words only, and common words that look like dates are left alone", () => {
    expect(p("Mondays are hard").date).toBeUndefined();
    expect(p("Buy sun cream").date).toBeUndefined();
    expect(p("Today's agenda").date).toBeUndefined();
    expect(p("Today's agenda").title).toBe("Today's agenda");
  });

  test("never parses a title down to nothing", () => {
    expect(p("Tomorrow")).toEqual({ title: "Tomorrow", matched: [] });
  });
});
