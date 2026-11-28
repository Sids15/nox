import type { Idea, Note, Space, Task } from "@nox/types";

/** What a widget can show, in the order the user picks. */
export const widgetSectionKeys = ["today", "next", "capture", "space", "pinned"] as const;
export type WidgetSectionKey = (typeof widgetSectionKeys)[number];

export const WIDGET_SECTION_LABEL: Record<WidgetSectionKey, string> = {
  today: "Today's tasks",
  next: "Up next",
  capture: "Quick add",
  space: "A space's pipeline",
  pinned: "Pinned notes",
};

/** The widget's settings: shared by the desktop widget window and the Android home-screen widget. */
export interface WidgetConfig {
  sections: { key: WidgetSectionKey; on: boolean }[];
  /** The space whose pipeline the "space" section shows (null: the first space). */
  spaceId: string | null;
  /** Rows per list, 3–8. */
  maxItems: number;
  /** Keep finished tasks in "Today" (struck through) instead of hiding them. */
  showDone: boolean;
  /** Desktop: float the widget above other windows. */
  alwaysOnTop: boolean;
  /** Tighter rows. */
  compact: boolean;
}

export const DEFAULT_WIDGET: WidgetConfig = {
  sections: [
    { key: "today", on: true },
    { key: "next", on: true },
    { key: "capture", on: true },
    { key: "space", on: false },
    { key: "pinned", on: false },
  ],
  spaceId: null,
  maxItems: 5,
  showDone: true,
  alwaysOnTop: true,
  compact: false,
};

/** A stored config made whole: unknown keys dropped, missing sections added (off), limits kept. */
export function normalizeWidgetConfig(raw: Partial<WidgetConfig> | null | undefined): WidgetConfig {
  const c = { ...DEFAULT_WIDGET, ...(raw ?? {}) };
  const seen = new Set<WidgetSectionKey>();
  const sections = (Array.isArray(c.sections) ? c.sections : []).filter(
    (s): s is { key: WidgetSectionKey; on: boolean } =>
      !!s && (widgetSectionKeys as readonly string[]).includes(s.key) && !seen.has(s.key) && !!seen.add(s.key),
  );
  for (const k of widgetSectionKeys) if (!seen.has(k)) sections.push({ key: k, on: false });
  return {
    sections: sections.map((s) => ({ key: s.key, on: !!s.on })),
    spaceId: typeof c.spaceId === "string" ? c.spaceId : null,
    maxItems: Math.min(8, Math.max(3, Math.round(Number(c.maxItems) || DEFAULT_WIDGET.maxItems))),
    showDone: c.showDone !== false,
    alwaysOnTop: c.alwaysOnTop !== false,
    compact: !!c.compact,
  };
}

export interface WidgetTaskRow {
  id: string;
  title: string;
  /** "HH:MM", or null when it has no time. */
  time: string | null;
  done: boolean;
}

export type WidgetSection =
  | { kind: "today"; total: number; done: number; items: WidgetTaskRow[]; more: number }
  | { kind: "next"; items: WidgetTaskRow[] }
  | { kind: "capture" }
  | { kind: "space"; spaceId: string; name: string; icon: string; pages: number }
  | { kind: "pinned"; items: { id: string; title: string }[] };

/** Everything a widget draws, as plain JSON (the Android widget gets exactly this). */
export interface WidgetSnapshot {
  v: 1;
  generatedAt: string;
  /** "YYYY-MM-DD" the snapshot is for. */
  date: string;
  compact: boolean;
  sections: WidgetSection[];
}

const isTemplate = (t: Task) => t.repeat !== "none" && t.origin_task_id === null;
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);
const noteName = (n: Note) =>
  n.title?.trim() ||
  n.content.map((b) => ("text" in b ? b.text.trim() : "")).find(Boolean)?.slice(0, 80) ||
  "Untitled note";

/**
 * Build what the widget shows from the app's data. `today` is the local "YYYY-MM-DD" and `nowHHMM`
 * the local time, passed in so the result is the same wherever it's computed (and testable).
 */
export function buildWidgetSnapshot(
  input: { tasks: Task[]; notes: Note[]; ideas: Idea[]; spaces: Space[]; config: WidgetConfig },
  today: string,
  nowHHMM: string,
  generatedAt = new Date().toISOString(),
): WidgetSnapshot {
  const { config } = input;
  const live = input.tasks.filter((t) => !t.deleted && !isTemplate(t));
  // Today: due today, or undated and still open (the same rule as the Today list).
  const todays = live
    .filter((t) => t.due_date === today || (t.due_date === null && t.status !== "complete") || (t.status === "carried_over" && t.due_date === today))
    .sort((a, b) => Number(a.status === "complete") - Number(b.status === "complete") || (a.due_time ?? "99").localeCompare(b.due_time ?? "99") || a.sort_order - b.sort_order);
  const row = (t: Task): WidgetTaskRow => ({ id: t.id, title: t.title, time: hhmm(t.due_time), done: t.status === "complete" });

  const sections: WidgetSection[] = [];
  for (const s of config.sections) {
    if (!s.on) continue;
    if (s.key === "today") {
      const shown = config.showDone ? todays : todays.filter((t) => t.status !== "complete");
      sections.push({
        kind: "today",
        total: todays.length,
        done: todays.filter((t) => t.status === "complete").length,
        items: shown.slice(0, config.maxItems).map(row),
        more: Math.max(0, shown.length - config.maxItems),
      });
    } else if (s.key === "next") {
      const next = live
        .filter((t) => t.status !== "complete" && t.due_date === today && t.due_time && hhmm(t.due_time)! >= nowHHMM)
        .sort((a, b) => a.due_time!.localeCompare(b.due_time!))
        .slice(0, Math.min(3, config.maxItems));
      sections.push({ kind: "next", items: next.map(row) });
    } else if (s.key === "capture") {
      sections.push({ kind: "capture" });
    } else if (s.key === "space") {
      const space = input.spaces.find((x) => x.id === config.spaceId) ?? input.spaces[0];
      if (!space) continue;
      const pages = [
        ...input.notes.filter((n) => n.space_id === space.id && !n.is_archived),
        ...input.ideas.filter((i) => i.space_id === space.id && !i.is_archived && i.status !== "dropped"),
      ];
      sections.push({
        kind: "space",
        spaceId: space.id,
        name: space.name,
        icon: space.icon,
        pages: pages.length,
      });
    } else if (s.key === "pinned") {
      sections.push({
        kind: "pinned",
        items: input.notes
          .filter((n) => n.is_pinned && !n.is_archived)
          .slice(0, config.maxItems)
          .map((n) => ({ id: n.id, title: noteName(n) })),
      });
    }
  }
  return { v: 1, generatedAt, date: today, compact: config.compact, sections };
}
