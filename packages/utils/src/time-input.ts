/**
 * Parse what someone types into a time box: "6pm", "6:30 pm", "630pm", "18:30", "1830", "9", "noon".
 * Returns 24-hour "HH:MM", or null when it isn't a time.
 *
 * Without am/pm, an hour of 1–7 is read as afternoon/evening ("7" → 7 PM, "6:30" → 6:30 PM) — the
 * reading people mean for a task — while 8–11 stays morning and 0 or 12–23 are taken as 24-hour. A
 * leading zero ("07:00") opts out and means exactly that.
 */
export function parseTypedTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\./g, "");
  if (!s) return null;
  if (s === "noon" || s === "midday") return "12:00";
  if (s === "midnight") return "00:00";
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ap.startsWith("p") ? 12 : 0);
  } else if (h > 23) {
    return null;
  } else if (h >= 1 && h <= 7 && !m[1]!.startsWith("0")) {
    h += 12;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
