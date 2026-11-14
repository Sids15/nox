import { describe, expect, test } from "bun:test";
import { displayNameFrom, identityFrom, initialsFrom } from "./identity";

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

describe("identityFrom", () => {
  test("prefers the name typed at sign-up", () => {
    expect(identityFrom("ada@x.io", { display_name: "Ada Lovelace" })).toEqual({
      name: "Ada Lovelace",
      firstName: "Ada",
      initials: "AL",
    });
  });

  test("falls back to the provider's full_name, then name", () => {
    expect(identityFrom("a@x.io", { full_name: "Grace Brewster Hopper" }).initials).toBe("GH");
    expect(identityFrom("a@x.io", { name: "  Linus   Torvalds " }).name).toBe("Linus Torvalds");
  });

  test("a one-word name uses its first two letters", () => {
    expect(identityFrom("a@x.io", { display_name: "riley" }).initials).toBe("RI");
  });

  test("blank or non-string metadata falls back to the email", () => {
    expect(identityFrom("ada.lovelace@x.io", { display_name: "   ", name: 42 })).toEqual({
      name: "Ada",
      firstName: "Ada",
      initials: "AL",
    });
    expect(identityFrom("ada@x.io", null).name).toBe("Ada");
  });
});
