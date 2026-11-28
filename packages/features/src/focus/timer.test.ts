import { describe, expect, test } from "bun:test";
import {
  elapsedMs,
  endsAt,
  formatClock,
  formatMinutes,
  isFinished,
  minutesToLog,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startTimer,
} from "./timer";

const MIN = 60_000;
const T0 = 1_700_000_000_000;

describe("focus timer", () => {
  test("counts down from the planned length", () => {
    const t = startTimer("task", "space", 25, T0);
    expect(remainingMs(t, T0)).toBe(25 * MIN);
    expect(remainingMs(t, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(elapsedMs(t, T0 + 10 * MIN)).toBe(10 * MIN);
    expect(endsAt(t, T0 + 10 * MIN)).toBe(T0 + 25 * MIN);
  });

  test("pauses don't count, and resume picks up where it left off", () => {
    let t = startTimer(null, null, 25, T0);
    t = pauseTimer(t, T0 + 5 * MIN);
    // Paused for 30 minutes: nothing moves, and it has no end time.
    expect(elapsedMs(t, T0 + 35 * MIN)).toBe(5 * MIN);
    expect(endsAt(t, T0 + 35 * MIN)).toBeNull();
    t = resumeTimer(t, T0 + 35 * MIN);
    expect(elapsedMs(t, T0 + 40 * MIN)).toBe(10 * MIN);
    expect(remainingMs(t, T0 + 40 * MIN)).toBe(15 * MIN);
  });

  test("pausing twice or resuming while running changes nothing", () => {
    const t = startTimer(null, null, 25, T0);
    const p = pauseTimer(t, T0 + MIN);
    expect(pauseTimer(p, T0 + 2 * MIN)).toBe(p);
    expect(resumeTimer(t, T0 + MIN)).toBe(t);
  });

  test("stops at zero: never more than planned", () => {
    const t = startTimer(null, null, 25, T0);
    expect(isFinished(t, T0 + 24 * MIN)).toBe(false);
    expect(isFinished(t, T0 + 25 * MIN)).toBe(true);
    expect(elapsedMs(t, T0 + 3 * 60 * MIN)).toBe(25 * MIN);
    expect(minutesToLog(t, T0 + 3 * 60 * MIN)).toBe(25);
  });

  test("logs whole minutes, nothing under half a minute", () => {
    const t = startTimer(null, null, 25, T0);
    expect(minutesToLog(t, T0 + 20_000)).toBe(0);
    expect(minutesToLog(t, T0 + 7 * MIN + 40_000)).toBe(8);
  });

  test("lengths are kept to 1–600 minutes", () => {
    expect(startTimer(null, null, 0, T0).plannedMinutes).toBe(1);
    expect(startTimer(null, null, 9999, T0).plannedMinutes).toBe(600);
  });

  test("clock and duration text", () => {
    expect(formatClock(25 * MIN)).toBe("25:00");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(65 * MIN + 3000)).toBe("1:05:03");
    expect(formatClock(0)).toBe("0:00");
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(40)).toBe("40m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(85)).toBe("1h 25m");
  });
});
