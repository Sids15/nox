import { describe, expect, test } from "bun:test";
import type { GoogleEvent } from "@nox/types";
import { busyByDay, eventsByDay } from "./busy";

/** A local wall-clock time as an ISO instant (so the test passes in any time zone). */
const at = (day: string, h: number, m = 0) => {
  const [y, mo, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, mo - 1, d, h, m).toISOString();
};
const ev = (id: string, start: string, end: string, p: Partial<GoogleEvent> = {}): GoogleEvent => ({ id, title: id, start, end, allDay: false, link: null, ...p });

describe("eventsByDay", () => {
  test("local minutes on each day, sorted", () => {
    const m = eventsByDay([ev("b", at("2026-11-30", 14), at("2026-11-30", 15, 30)), ev("a", at("2026-11-30", 9), at("2026-11-30", 9, 15))], ["2026-11-30"]);
    expect(m.get("2026-11-30")).toEqual([
      { id: "a", title: "a", link: null, start: 540, end: 555 },
      { id: "b", title: "b", link: null, start: 840, end: 930 },
    ]);
  });

  test("across midnight: on both days", () => {
    const m = eventsByDay([ev("late", at("2026-11-30", 23), at("2026-12-01", 1))], ["2026-11-30", "2026-12-01"]);
    expect(m.get("2026-11-30")).toEqual([{ id: "late", title: "late", link: null, start: 1380, end: 1440 }]);
    expect(m.get("2026-12-01")).toEqual([{ id: "late", title: "late", link: null, start: 0, end: 60 }]);
  });

  test("all-day, broken and off-screen events are left out", () => {
    const m = eventsByDay(
      [
        ev("allday", "2026-11-30", "2026-12-01", { allDay: true }),
        ev("bad", "nope", "nope"),
        ev("backwards", at("2026-11-30", 10), at("2026-11-30", 9)),
        ev("other day", at("2026-12-05", 10), at("2026-12-05", 11)),
      ],
      ["2026-11-30"],
    );
    expect(m.size).toBe(0);
  });

  test("busyByDay gives [start, end] blocks", () => {
    expect(busyByDay([ev("a", at("2026-11-30", 10), at("2026-11-30", 11))], ["2026-11-30"])).toEqual({ "2026-11-30": [[600, 660]] });
  });
});
