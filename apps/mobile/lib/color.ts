/**
 * `color` at `alpha` (0–1). Accepts "#rgb", "#rrggbb" and "rgb(r, g, b)". Appending a hex suffix
 * (`${color}24`) only works for hex, and the theme's ink greys are rgb() — that produced an invalid
 * colour (drawn solid dark) for low-priority tasks on the calendar.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const n = parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  return color;
}
