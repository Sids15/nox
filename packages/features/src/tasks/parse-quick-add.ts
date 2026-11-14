import type { Task } from "@nox/types";
import { addDays, dayOfWeek } from "@nox/utils";

/**
 * Natural-language quick add: pulls a due date, time, priority and repeat rule out of a typed task
 * title — "Call mum tomorrow 6pm !high" → title "Call mum", tomorrow, 18:00, high — the way Todoist's
 * Smart Quick Add and TickTick's smart date parsing do. Pure and locale-free (English), so it is unit
 * tested and runs on every keystroke.
 *
 * Recognised:
 * - dates: today, tonight, tomorrow/tmr/tmrw, weekday names (next occurrence; today counts),
 *   "next week" (next Monday), "in N days|weeks", "Nov 21" / "21 Nov" / "November 21st"
 * - times: 6pm, 6:30pm, 6.30 pm, 18:00, noon, optionally preceded by "at"
 * - priority: !high/!h/!1/p1, !medium/!med/!m/!2/p2, !low/!l/!3/p3
 * - repeat: daily / every day, weekdays / every weekday, weekly / every week,
 *   every <weekday>[, <weekday>…]
 *
 * Matches are removed from the title. Only whole words match ("monday" inside "mondays" does not),
 * and a title that would be left empty is not parsed at all — "Today" stays a task called "Today".
 */

export type QuickAddField = "date" | "time" | "priority" | "repeat";

export interface QuickAddResult {
  /** The title with recognised phrases removed. */
  title: string;
  date?: string;
  time?: string;
  priority?: Task["priority"];
  repeat?: { kind: Exclude<Task["repeat"], "none">; weekdays?: number[] };
  /** Internal: "tonight" was typed — resolved to 20:00 unless a time was typed too. */
  tonight?: boolean;
  /** The phrases that were recognised, in the order they appear, with their [start, end) offsets in
   *  the input — so the UI can highlight them in place. */
  matched: { field: QuickAddField; text: string; start: number; end: number }[];
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6,
  june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const WD = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join("|");
/** Bare weekday words that are safe without "on"/"next": the full names. "sun", "sat" and "wed"
 *  are everyday words ("sun cream", "I sat"), so abbreviations need a prefix. */
const WD_FULL = "sunday|monday|tuesday|wednesday|thursday|friday|saturday";
const MO = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const pad = (n: number) => String(n).padStart(2, "0");

/** The next date on/after `today` that falls on weekday `dow`. */
function nextWeekday(today: string, dow: number): string {
  return addDays(today, (dow - dayOfWeek(today) + 7) % 7);
}

/** Month+day → the next such date on/after today (rolls into next year when already past). */
function monthDay(today: string, month: number, day: number): string | null {
  if (day < 1 || day > 31) return null;
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const d = new Date(y, month - 1, day);
    if (d.getMonth() !== month - 1) return null; // e.g. Feb 30
    const key = `${y}-${pad(month)}-${pad(day)}`;
    if (key >= today) return key;
  }
  return null;
}

function to24(h: number, m: number, ampm: string | undefined): string | null {
  if (m > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    const pm = ampm.toLowerCase().startsWith("p");
    h = (h % 12) + (pm ? 12 : 0);
  } else if (h > 23) {
    return null;
  }
  return `${pad(h)}:${pad(m)}`;
}

interface Rule {
  field: QuickAddField;
  re: RegExp;
  apply: (m: RegExpExecArray, today: string, out: QuickAddResult) => boolean;
}

// Ordered most-specific first; each rule claims its text, so later rules can't double-match it.
// `(?<![\w!])` / `(?![\w])` are the whole-word guards.
const B = "(?<![\\w!])";
const E = "(?![\\w'’])"; // also stops "today" matching inside "today's"

const RULES: Rule[] = [
  // ── repeat ──
  {
    field: "repeat",
    re: new RegExp(`${B}every\\s+((?:${WD})(?:\\s*(?:,|and|&)\\s*(?:${WD}))*)${E}`, "i"),
    apply: (m, _t, out) => {
      const days = [...new Set(m[1]!.toLowerCase().split(/\s*(?:,|and|&)\s*/).map((w) => WEEKDAYS[w.trim()]!))]
        .filter((d) => d !== undefined)
        .sort((a, b) => a - b);
      out.repeat = { kind: "custom", weekdays: days };
      return true;
    },
  },
  { field: "repeat", re: new RegExp(`${B}(?:every\\s+weekday|weekdays)${E}`, "i"), apply: (_m, _t, out) => ((out.repeat = { kind: "weekdays" }), true) },
  { field: "repeat", re: new RegExp(`${B}(?:every\\s+day|daily)${E}`, "i"), apply: (_m, _t, out) => ((out.repeat = { kind: "daily" }), true) },
  { field: "repeat", re: new RegExp(`${B}(?:every\\s+week|weekly)${E}`, "i"), apply: (_m, _t, out) => ((out.repeat = { kind: "weekly" }), true) },

  // ── priority ──
  {
    field: "priority",
    re: /(?<![\w])(?:!(high|h|1|medium|med|m|2|low|l|3)|p([123]))(?![\w'’])/i,
    apply: (m, _t, out) => {
      const v = (m[1] ?? m[2]!).toLowerCase();
      out.priority = ["high", "h", "1"].includes(v) ? "high" : ["low", "l", "3"].includes(v) ? "low" : "medium";
      return true;
    },
  },

  // ── dates ──
  {
    field: "date",
    re: new RegExp(`${B}(?:on\\s+)?(${MO})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?${E}`, "i"),
    apply: (m, today, out) => {
      const d = monthDay(today, MONTHS[m[1]!.toLowerCase()]!, Number(m[2]));
      if (!d) return false;
      out.date = d;
      return true;
    },
  },
  {
    field: "date",
    re: new RegExp(`${B}(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MO})${E}`, "i"),
    apply: (m, today, out) => {
      const d = monthDay(today, MONTHS[m[2]!.toLowerCase()]!, Number(m[1]));
      if (!d) return false;
      out.date = d;
      return true;
    },
  },
  {
    field: "date",
    re: /(?<![\w])in\s+(\d{1,3})\s+(days?|weeks?)(?![\w'’])/i,
    apply: (m, today, out) => {
      const n = Number(m[1]) * (m[2]!.toLowerCase().startsWith("w") ? 7 : 1);
      if (n < 1) return false;
      out.date = addDays(today, n);
      return true;
    },
  },
  {
    field: "date",
    re: /(?<![\w])next\s+week(?![\w'’])/i,
    apply: (_m, today, out) => ((out.date = addDays(today, ((8 - dayOfWeek(today)) % 7) || 7)), true),
  },
  {
    field: "date",
    re: /(?<![\w])tonight(?![\w'’])/i,
    apply: (_m, today, out) => {
      out.date = today;
      out.tonight = true; // 8 PM unless a time is typed too ("tonight at 10pm")
      return true;
    },
  },
  { field: "date", re: /(?<![\w])today(?![\w'’])/i, apply: (_m, today, out) => ((out.date = today), true) },
  { field: "date", re: /(?<![\w])(?:tomorrow|tmrw?)(?![\w'’])/i, apply: (_m, today, out) => ((out.date = addDays(today, 1)), true) },
  {
    field: "date",
    re: new RegExp(`${B}(?:(?:on|next)\\s+(${WD})|(${WD_FULL}))${E}`, "i"),
    apply: (m, today, out) => ((out.date = nextWeekday(today, WEEKDAYS[(m[1] ?? m[2])!.toLowerCase()]!)), true),
  },

  // ── times ──
  { field: "time", re: /(?<![\w])(?:at\s+)?noon(?![\w'’])/i, apply: (_m, _t, out) => ((out.time = "12:00"), true) },
  {
    field: "time",
    re: /(?<![\w:.])(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?![\w'’])/i,
    apply: (m, _t, out) => {
      const t = to24(Number(m[1]), Number(m[2] ?? 0), m[3]);
      if (!t) return false;
      out.time = t;
      return true;
    },
  },
  {
    field: "time",
    re: /(?<![\w:.])(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?![\w:])/i,
    apply: (m, _t, out) => ((out.time = `${pad(Number(m[1]))}:${m[2]}`), true),
  },
];

export function parseQuickAdd(input: string, today: string): QuickAddResult {
  const out: QuickAddResult = { title: input.trim(), matched: [] };
  let rest = input;
  const spans: { start: number; end: number; field: QuickAddField; text: string }[] = [];
  const claimed = new Set<QuickAddField>();

  for (const rule of RULES) {
    if (claimed.has(rule.field)) continue; // one value per field: the most specific rule wins
    const m = rule.re.exec(rest);
    if (!m) continue;
    const trial: QuickAddResult = { ...out, matched: [] };
    if (!rule.apply(m, today, trial)) continue;
    Object.assign(out, { date: trial.date, time: trial.time, priority: trial.priority, repeat: trial.repeat, tonight: trial.tonight });
    claimed.add(rule.field);
    spans.push({ start: m.index, end: m.index + m[0].length, field: rule.field, text: m[0].trim() });
    // Blank the claimed text (same length) so indices stay valid and nothing re-matches it.
    rest = rest.slice(0, m.index) + " ".repeat(m[0].length) + rest.slice(m.index + m[0].length);
  }

  if (spans.length === 0) return { title: out.title, matched: [] };
  if (out.tonight && out.time === undefined) out.time = "20:00";
  delete out.tonight;

  const title = rest.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim().replace(/^[,;:\-–—]+\s*|\s*[,;:\-–—]+$/g, "");
  // Never parse a title down to nothing.
  if (!title) return { title: input.trim(), matched: [] };

  // A repeat with no date anchors on the first day the rule hits (today counts).
  if (out.repeat && out.date === undefined) {
    const days = out.repeat.kind === "custom" ? out.repeat.weekdays ?? [] : [];
    if (days.length) {
      out.date = days.map((d) => nextWeekday(today, d)).sort()[0];
    } else if (out.repeat.kind === "weekdays") {
      const dow = dayOfWeek(today);
      out.date = addDays(today, dow === 6 ? 2 : dow === 0 ? 1 : 0);
    } else {
      out.date = today;
    }
  }

  out.title = title;
  out.matched = spans
    .sort((a, b) => a.start - b.start)
    .map(({ field, start, end }) => {
      // Trim the claimed span to the phrase itself (rules may have eaten surrounding whitespace).
      const raw = input.slice(start, end);
      const lead = raw.length - raw.trimStart().length;
      const text = raw.trim();
      return { field, text, start: start + lead, end: start + lead + text.length };
    });
  return out;
}
