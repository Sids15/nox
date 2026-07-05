import { describe, expect, test } from "bun:test";
import { displayNameFrom, initialsFrom } from "./identity";

describe("initialsFrom", () => {
  test("two letters from a plain local-part", () => {
    expect(initialsFrom("siddhant@gmail.com")).toBe("SI");
  });
  test("first letters of two chunks when separated", () => {
    expect(initialsFrom("ada.lovelace@example.com")).toBe("AL");
    expect(initialsFrom("jean_luc@ship.fed")).toBe("JL");
    expect(initialsFrom("a-b@x.io")).toBe("AB");
  });
  test("single-letter local-part", () => {
    expect(initialsFrom("x@y.z")).toBe("X");
  });
  test("empty / null / no local-part fall back to ?", () => {
    expect(initialsFrom("")).toBe("?");
    expect(initialsFrom(null)).toBe("?");
    expect(initialsFrom(undefined)).toBe("?");
  });
});

describe("displayNameFrom", () => {
  test("capitalizes the first chunk", () => {
    expect(displayNameFrom("siddhant@gmail.com")).toBe("Siddhant");
    expect(displayNameFrom("ada.lovelace@example.com")).toBe("Ada");
  });
  test("empty falls back to You", () => {
    expect(displayNameFrom(null)).toBe("You");
  });
});
