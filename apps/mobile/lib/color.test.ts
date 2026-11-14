import { describe, expect, test } from "bun:test";
import { withAlpha } from "./color";

describe("withAlpha", () => {
  test("hex, short hex and rgb()", () => {
    expect(withAlpha("#D9472B", 0.5)).toBe("rgba(217, 71, 43, 0.5)");
    expect(withAlpha("#fff", 0.1)).toBe("rgba(255, 255, 255, 0.1)");
    expect(withAlpha("rgb(110, 111, 119)", 0.14)).toBe("rgba(110, 111, 119, 0.14)");
  });
  test("leaves anything else alone", () => {
    expect(withAlpha("transparent", 0.5)).toBe("transparent");
  });
});
