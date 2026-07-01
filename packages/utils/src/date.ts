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
