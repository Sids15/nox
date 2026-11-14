import { describe, expect, test } from "bun:test";
import { parseTypedTime } from "./time-input";

describe("parseTypedTime", () => {
  test("12-hour with am/pm, with or without a colon or space", () => {
    expect(parseTypedTime("6pm")).toBe("18:00");
    expect(parseTypedTime("6:30 pm")).toBe("18:30");
    expect(parseTypedTime("630pm")).toBe("18:30");
    expect(parseTypedTime("9:15am")).toBe("09:15");
    expect(parseTypedTime("12am")).toBe("00:00");
    expect(parseTypedTime("12pm")).toBe("12:00");
    expect(parseTypedTime("7 p.m.")).toBe("19:00");
  });

  test("24-hour", () => {
    expect(parseTypedTime("18:30")).toBe("18:30");
    expect(parseTypedTime("1830")).toBe("18:30");
    expect(parseTypedTime("0")).toBe("00:00");
  });

  test("a bare 1–7 means the evening; 8–11 the morning; a leading zero means exactly that", () => {
    expect(parseTypedTime("7")).toBe("19:00");
    expect(parseTypedTime("6:30")).toBe("18:30");
    expect(parseTypedTime("9")).toBe("09:00");
    expect(parseTypedTime("07:00")).toBe("07:00");
  });

  test("words", () => {
    expect(parseTypedTime("noon")).toBe("12:00");
    expect(parseTypedTime("Midnight")).toBe("00:00");
  });

  test("not a time", () => {
    expect(parseTypedTime("")).toBeNull();
    expect(parseTypedTime("25:00")).toBeNull();
    expect(parseTypedTime("6:75")).toBeNull();
    expect(parseTypedTime("13pm")).toBeNull();
    expect(parseTypedTime("soon")).toBeNull();
  });
});
