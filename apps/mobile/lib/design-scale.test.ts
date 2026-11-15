import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Nox's type scale and icon weights. Every `text-[Npx]` in the app must be one of these sizes, so
 * the same role reads the same everywhere (it had drifted to 28 sizes, half-pixel steps apart).
 *   11 caption · 12 meta · 13 secondary · 14 small body / buttons · 15 body · 16 large body / inputs
 *   17 card titles · 20 section & pane titles · 24 editor titles · 30 page titles · 32 sign-in display
 *   44 the sign-in cover's promise · 7 the "15" inside the skip-15s icons
 */
const TYPE_SCALE = new Set([7, 11, 12, 13, 14, 15, 16, 17, 20, 24, 30, 32, 44]);
/** Icon strokes: 2 for icons; heavier only for small marks (checks, plus, ×). */
const STROKES = new Set([2, 2.2, 2.4, 2.6, 2.8, 3, 3.2]);

const root = join(import.meta.dir, "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}
const sources = [...files(join(root, "app")), ...files(join(root, "components"))].map((p) => ({
  file: relative(root, p),
  text: readFileSync(p, "utf8"),
}));

describe("design scale", () => {
  test("every font size is on the type scale", () => {
    const off = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].filter((m) => !TYPE_SCALE.has(Number(m[1]))).map((m) => `${file}: ${m[0]}`),
    );
    expect(off).toEqual([]);
  });

  test("every icon uses a standard stroke weight", () => {
    const off = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/strokeWidth=\{(\d+(?:\.\d+)?)\}/g)].filter((m) => !STROKES.has(Number(m[1]))).map((m) => `${file}: ${m[0]}`),
    );
    expect(off).toEqual([]);
  });

  test("filters use the funnel icon everywhere", () => {
    const sliders = sources.filter(({ text }) => /<SlidersHorizontal\b/.test(text)).map(({ file }) => file);
    expect(sliders).toEqual([]);
  });
});
