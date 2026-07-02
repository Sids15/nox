/** Local calendar-date helpers (YYYY-MM-DD), timezone = device local.
 *  Tasks are grouped by local day, so we deliberately avoid UTC shifting. */

export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt);
}

export function isOverdue(dateKey: string | null, ref: string = todayKey()): boolean {
  return dateKey !== null && dateKey < ref;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

function parts(dateKey: string): [number, number, number] {
  return dateKey.split("-").map(Number) as [number, number, number];
}

/** The seven date keys (Sun→Sat) of the week containing `focus`. */
export function weekDates(focus: string = todayKey()): string[] {
  const [y, m, d] = parts(focus);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  const sunday = toDateKey(new Date(y, m - 1, d - dow));
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

/** Day-of-month number, e.g. "2026-07-02" → 2. */
export function dayOfMonth(dateKey: string): number {
  return parts(dateKey)[2];
}

/** Uppercase weekday abbreviation, e.g. "WED". */
export function weekdayShort(dateKey: string): string {
  const [y, m, d] = parts(dateKey);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]!;
}

/** Uppercase month abbreviation, e.g. "JUL". */
export function monthShort(dateKey: string): string {
  return MONTHS[parts(dateKey)[1] - 1]!;
}

/** 24h "HH:MM" (as stored on tasks) → "6:00 PM". Returns null for a null input. */
export function formatTime12(time: string | null): string | null {
  if (!time) return null;
  const [hRaw, mRaw] = time.split(":");
  let h = Number(hRaw);
  const m = (mRaw ?? "00").padStart(2, "0");
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

/** Whole-day signed difference `a - b` (local midnights). */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  const ms = new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime();
  return Math.round(ms / 86_400_000);
}

function titleCase(upper: string): string {
  return upper[0] + upper.slice(1).toLowerCase();
}

/** Human day label relative to `ref`: today / yesterday / tomorrow / "Mon" / else "Jul 2". */
export function relativeDayLabel(dateKey: string, ref: string = todayKey()): string {
  if (dateKey === ref) return "today";
  if (dateKey === addDays(ref, -1)) return "yesterday";
  if (dateKey === addDays(ref, 1)) return "tomorrow";
  // within a week the weekday reads clearest; otherwise fall back to "Jul 2"
  if (Math.abs(dayDiff(dateKey, ref)) <= 6) return titleCase(weekdayShort(dateKey));
  return `${titleCase(monthShort(dateKey))} ${dayOfMonth(dateKey)}`;
}
