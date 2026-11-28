import type { Task } from "@nox/types";

/**
 * Bringing tasks in from other apps. Each reader turns an export into the same plain shape; nothing
 * here touches the network or the database. Supported: Todoist (CSV export), TickTick (backup CSV),
 * Notion (database exported as CSV), and text lists (Markdown checklists, Apple Reminders shared as
 * text, any list with one task per line).
 */

export type ImportFormat = "todoist" | "ticktick" | "notion" | "text";

export interface ImportedTask {
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: Task["priority"];
  done: boolean;
  /** The list / project / folder it came from, if any (can become a space). */
  list: string | null;
}

export interface ImportResult {
  format: ImportFormat;
  tasks: ImportedTask[];
  /** Rows that weren't tasks (sections, headings, empty titles). */
  skipped: number;
}

/** At most this many tasks come in from one import. */
export const IMPORT_LIMIT = 2000;

// ── CSV ────────────────────────────────────────────────────────────────────────────────────────────
/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Rows as objects keyed by the header row (found by `isHeader`, so preamble lines are skipped). */
function records(text: string, isHeader: (cells: string[]) => boolean): Record<string, string>[] {
  const rows = parseCsv(text);
  const at = rows.findIndex((r) => isHeader(r.map((c) => c.trim().toLowerCase())));
  if (at < 0) return [];
  const head = rows[at]!.map((h) => h.trim());
  return rows.slice(at + 1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// ── Dates ──────────────────────────────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A date (and maybe a time) from what exports write: "2026-11-30", "2026-11-30T14:00:00+0000",
 * "2026-11-30 14:00", "Nov 30 2026", "30 Nov 2026 2pm", "November 30, 2026". A timestamp with a zone
 * is read in the local time zone. Anything else (relative words, "every day") is null.
 */
export function parseDate(raw: string): { date: string; time: string | null } | null {
  const s = raw.trim();
  if (!s) return null;
  // A full timestamp with a zone: convert to local.
  const zoned = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/);
  if (zoned) {
    const iso = s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    // An all-day item is exported as midnight UTC: keep the day, drop the time.
    const midnightUtc = /T00:00(:00)?(\.0+)?(Z|\+00:?00)$/.test(s);
    return midnightUtc ? { date: `${zoned[1]}-${zoned[2]}-${zoned[3]}`, time: null } : { date, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) return valid(+iso[1]!, +iso[2]!, +iso[3]!, iso[4] ? `${pad(+iso[4])}:${iso[5]}` : null);
  const lower = s.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  const time = readTime(lower);
  const md = lower.match(/\b([a-z]{3})[a-z]*\.? (\d{1,2})(?:st|nd|rd|th)? (\d{4})\b/);
  if (md && MONTHS.includes(md[1]!)) return valid(+md[3]!, MONTHS.indexOf(md[1]!) + 1, +md[2]!, time);
  const dm = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3})[a-z]*\.? (\d{4})\b/);
  if (dm && MONTHS.includes(dm[2]!)) return valid(+dm[3]!, MONTHS.indexOf(dm[2]!) + 1, +dm[1]!, time);
  return null;
}

function valid(y: number, m: number, d: number, time: string | null) {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return { date: `${y}-${pad(m)}-${pad(d)}`, time };
}

function readTime(s: string): string | null {
  const t = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!t) return null;
  let h = +t[1]!;
  const m = t[2] ? +t[2] : 0;
  if (t[3] === "pm" && h < 12) h += 12;
  if (t[3] === "am" && h === 12) h = 0;
  return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : null;
}

const clean = (title: string) => title.replace(/\s+/g, " ").trim().slice(0, 200);
const note = (parts: (string | null | undefined)[]) => {
  const text = parts.filter((p): p is string => !!p && p.trim() !== "").join("\n").trim();
  return text ? text.slice(0, 2000) : null;
};

// ── Todoist ────────────────────────────────────────────────────────────────────────────────────────
/**
 * Todoist's CSV export (one project per file): TYPE, CONTENT, DESCRIPTION, PRIORITY, …, DATE. Only
 * `task` rows; sections become the list name of the tasks under them. PRIORITY 1 is p1 (the highest):
 * p1 and p2 come in as high, p3 and p4 as medium.
 * A repeating date ("every monday") keeps its wording in the notes.
 */
export function fromTodoist(text: string): ImportResult {
  const rows = records(text, (h) => h.includes("type") && h.includes("content"));
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  let section: string | null = null;
  for (const r of rows) {
    const type = (r.TYPE ?? r.type ?? "").toLowerCase();
    const content = r.CONTENT ?? r.content ?? "";
    if (type === "section") {
      section = clean(content) || null;
      continue;
    }
    if (type !== "task" || !clean(content)) {
      skipped++;
      continue;
    }
    const rawDate = r.DATE ?? r.date ?? "";
    const when = parseDate(rawDate);
    const p = Number(r.PRIORITY ?? r.priority ?? 4);
    tasks.push({
      title: clean(content),
      notes: note([r.DESCRIPTION ?? r.description, rawDate && !when ? `Todoist date: ${rawDate}` : null]),
      due_date: when?.date ?? null,
      due_time: when?.time ?? null,
      priority: p === 1 || p === 2 ? "high" : "medium",
      done: false,
      list: section,
    });
  }
  return { format: "todoist", tasks: tasks.slice(0, IMPORT_LIMIT), skipped };
}

// ── TickTick ───────────────────────────────────────────────────────────────────────────────────────
/**
 * TickTick's backup CSV: a few preamble lines, then "Folder Name","List Name","Title",…,"Due Date",
 * "Priority","Status",… Priority 5 high, 3 medium, 1/0 low/none; Status 0 open, 1 or 2 done.
 */
export function fromTickTick(text: string): ImportResult {
  const rows = records(text, (h) => h.includes("title") && h.includes("list name"));
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  for (const r of rows) {
    const title = clean(r["Title"] ?? "");
    if (!title || (r["Kind"] ?? "").toLowerCase() === "note") {
      skipped++;
      continue;
    }
    const when = parseDate(r["Due Date"] ?? "") ?? parseDate(r["Start Date"] ?? "");
    const p = Number(r["Priority"] ?? 0);
    const status = r["Status"] ?? "0";
    tasks.push({
      title,
      notes: note([r["Content"], r["Repeat"] ? `Repeats: ${r["Repeat"]}` : null]),
      due_date: when?.date ?? null,
      due_time: r["Is All Day"]?.toLowerCase() === "true" ? null : (when?.time ?? null),
      priority: p >= 5 ? "high" : p === 1 ? "low" : "medium",
      done: status === "1" || status === "2",
      list: r["List Name"] || r["Folder Name"] || null,
    });
  }
  return { format: "ticktick", tasks: tasks.slice(0, IMPORT_LIMIT), skipped };
}

// ── Notion ─────────────────────────────────────────────────────────────────────────────────────────
const DONE_WORDS = new Set(["done", "complete", "completed", "finished", "closed", "yes", "true", "✓"]);

/**
 * A Notion database exported as CSV: the first column is the title ("Name", "Title" or "Task"). A column
 * called Date / Due / Due date gives the day, Status or a Done checkbox says if it's finished,
 * Priority maps High / Medium / Low, and Tags or Project becomes the list. Other columns go to notes.
 */
export function fromNotion(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { format: "notion", tasks: [], skipped: 0 };
  const head = rows[0]!.map((h) => h.replace(/^﻿/, "").trim());
  const find = (...names: string[]) => head.findIndex((h) => names.includes(h.toLowerCase()));
  const iDate = find("date", "due", "due date", "deadline", "when");
  const iStatus = find("status", "done", "complete", "completed", "checkbox");
  const iPriority = find("priority");
  const iList = find("project", "list", "tags", "area");
  const used = new Set([0, iDate, iStatus, iPriority, iList]);
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const title = clean(r[0] ?? "");
    if (!title) {
      skipped++;
      continue;
    }
    // A Notion date range "November 30, 2026 → December 2, 2026": the start.
    const when = iDate >= 0 ? parseDate((r[iDate] ?? "").split("→")[0]!) : null;
    const pr = (iPriority >= 0 ? r[iPriority] ?? "" : "").toLowerCase();
    const extra = head.map((h, i) => (used.has(i) || !(r[i] ?? "").trim() ? null : `${h}: ${r[i]!.trim()}`));
    tasks.push({
      title,
      notes: note(extra),
      due_date: when?.date ?? null,
      due_time: when?.time ?? null,
      priority: /high|urgent|p1/.test(pr) ? "high" : /low|p3/.test(pr) ? "low" : "medium",
      done: iStatus >= 0 && DONE_WORDS.has((r[iStatus] ?? "").trim().toLowerCase()),
      list: iList >= 0 ? (r[iList] ?? "").split(",")[0]!.trim() || null : null,
    });
  }
  return { format: "notion", tasks: tasks.slice(0, IMPORT_LIMIT), skipped };
}

// ── Text lists ─────────────────────────────────────────────────────────────────────────────────────
/**
 * One task per line: Markdown checklists ("- [ ] call", "- [x] done"), bullets, numbers, or plain
 * lines (Apple Reminders shares a list this way). "# Heading" lines name the list for what follows.
 */
export function fromText(text: string): ImportResult {
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  let list: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      list = clean(heading[1]!) || null;
      skipped++;
      continue;
    }
    const check = line.match(/^(?:[-*+•◦]|\d+[.)])?\s*\[([ xX])\]\s*(.*)$/);
    const body = check ? check[2]! : line.replace(/^(?:[-*+•◦]|\d+[.)])\s+/, "");
    const title = clean(body);
    if (!title) {
      skipped++;
      continue;
    }
    tasks.push({ title, notes: null, due_date: null, due_time: null, priority: "medium", done: check ? check[1] !== " " : false, list });
  }
  return { format: "text", tasks: tasks.slice(0, IMPORT_LIMIT), skipped };
}

/** Which reader fits a file (by its header row), falling back to a text list. */
export function detectFormat(text: string): ImportFormat {
  const head = text.replace(/^﻿/, "").split(/\r?\n/).slice(0, 12).join("\n").toLowerCase();
  if (/(^|\n)"?type"?,"?content"?/.test(head)) return "todoist";
  if (head.includes('"list name"') || head.includes("list name,")) return "ticktick";
  // A Notion database: a CSV header naming the title column and at least one other.
  const cells = (parseCsv(text.split(/\r?\n/)[0] ?? "")[0] ?? []).map((c) => c.replace(/^\uFEFF/, "").trim().toLowerCase());
  if (cells.length >= 2 && ["name", "title", "task", "tasks"].includes(cells[0]!)) return "notion";
  return "text";
}

export function parseImport(text: string, format: ImportFormat = detectFormat(text)): ImportResult {
  switch (format) {
    case "todoist":
      return fromTodoist(text);
    case "ticktick":
      return fromTickTick(text);
    case "notion":
      return fromNotion(text);
    default:
      return fromText(text);
  }
}
