import { describe, expect, test } from "bun:test";
import { passwordStrength } from "./password";

describe("passwordStrength", () => {
  test("empty is score 0 with no label", () => {
    expect(passwordStrength("")).toEqual({ score: 0, label: "" });
  });
  test("short letters-only is weak", () => {
    expect(passwordStrength("abcdef")).toMatchObject({ score: 0, label: "" });
    expect(passwordStrength("abcdefgh")).toMatchObject({ score: 1, label: "Weak" });
  });
  test("length + letters&digits is good", () => {
    expect(passwordStrength("abcd1234")).toMatchObject({ score: 2, label: "Good" });
  });
  test("adds a point for a symbol or long length", () => {
    expect(passwordStrength("abcd1234!")).toMatchObject({ score: 3, label: "Strong" });
    expect(passwordStrength("abcd1234efgh")).toMatchObject({ score: 3, label: "Strong" });
  });
});
