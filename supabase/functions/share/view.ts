// What a share link shows: a text-only copy of a note, idea or space. Pure (no Deno or network), so
// it's unit-tested; index.ts feeds it database rows. Whatever isn't listed here is never sent:
// no ids, owner, storage paths (pictures, recordings, sketches), tags, fields or anything else.

export type Block = { type: "paragraph" | "heading"; text: string; level?: number } | { type: "link"; url: string; title: string | null };

export interface SharedNote {
  kind: "note" | "idea";
  title: string;
  /** An idea's status ("raw", "exploring", …); null for notes. */
  status: string | null;
  description: string | null;
  blocks: Block[];
  updated_at: string;
}

export interface SharedSpace {
  kind: "space";
  name: string;
  icon: string;
  goal: string | null;
  due_date: string | null;
  tasks: { title: string; done: boolean; due_date: string | null }[];
  pages: { kind: "note" | "idea"; title: string }[];
  updated_at: string;
}

export const MAX_BLOCKS = 400;
export const MAX_TASKS = 300;
export const MAX_PAGES = 200;

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const httpUrl = (v: unknown): string | null => {
  const s = str(v, 2000);
  return /^https?:\/\//i.test(s) ? s : null;
};

/** Text blocks only; anything stored (image, audio, sketch) or unknown is dropped. */
export function textBlocks(content: unknown): Block[] {
  if (!Array.isArray(content)) return [];
  const out: Block[] = [];
  for (const b of content) {
    if (!b || typeof b !== "object") continue;
    const t = (b as { type?: unknown }).type;
    if (t === "paragraph") out.push({ type: "paragraph", text: str((b as { text?: unknown }).text, 20_000) });
    else if (t === "heading") {
      const level = Number((b as { level?: unknown }).level);
      out.push({ type: "heading", text: str((b as { text?: unknown }).text, 500), ...(level >= 1 && level <= 3 ? { level } : {}) });
    } else if (t === "link") {
      const url = httpUrl((b as { url?: unknown }).url);
      if (url) out.push({ type: "link", url, title: str((b as { title?: unknown }).title, 500) || null });
    }
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

const noteTitle = (row: Record<string, unknown>) => {
  const t = str(row.title, 200).trim();
  if (t) return t;
  const first = textBlocks(row.content).find((b) => b.type !== "link" && b.text.trim());
  return first && first.type !== "link" ? first.text.trim().slice(0, 80) : "Untitled";
};

export function viewNote(row: Record<string, unknown>): SharedNote {
  return { kind: "note", title: noteTitle(row), status: null, description: null, blocks: textBlocks(row.content), updated_at: str(row.updated_at, 40) };
}

export function viewIdea(row: Record<string, unknown>): SharedNote {
  return {
    kind: "idea",
    title: str(row.title, 200) || "Untitled idea",
    status: str(row.status, 20) || null,
    description: str(row.description, 20_000) || null,
    blocks: textBlocks(row.content),
    updated_at: str(row.updated_at, 40),
  };
}

const isTemplate = (t: Record<string, unknown>) => t.repeat !== "none" && t.origin_task_id == null;

export function viewSpace(
  space: Record<string, unknown>,
  tasks: Record<string, unknown>[],
  notes: Record<string, unknown>[],
  ideas: Record<string, unknown>[],
): SharedSpace {
  const live = (r: Record<string, unknown>) => r.deleted !== true && r.is_archived !== true;
  return {
    kind: "space",
    name: str(space.name, 80) || "Space",
    icon: str(space.icon, 16),
    goal: str(space.description, 500) || null,
    due_date: /^\d{4}-\d{2}-\d{2}$/.test(str(space.due_date, 10)) ? str(space.due_date, 10) : null,
    tasks: tasks
      .filter((t) => live(t) && !isTemplate(t))
      .sort((a, b) => Number(a.status === "complete") - Number(b.status === "complete") || str(a.due_date, 10).localeCompare(str(b.due_date, 10)))
      .slice(0, MAX_TASKS)
      .map((t) => ({ title: str(t.title, 200), done: t.status === "complete", due_date: /^\d{4}-\d{2}-\d{2}$/.test(str(t.due_date, 10)) ? str(t.due_date, 10) : null })),
    pages: [
      ...notes.filter(live).map((n) => ({ kind: "note" as const, title: noteTitle(n) })),
      ...ideas.filter((i) => live(i) && i.status !== "dropped").map((i) => ({ kind: "idea" as const, title: str(i.title, 200) || "Untitled idea" })),
    ].slice(0, MAX_PAGES),
    updated_at: str(space.updated_at, 40),
  };
}

/** A share token as the database makes them: 64 lower-case hex characters. */
export const isToken = (t: unknown): t is string => typeof t === "string" && /^[0-9a-f]{64}$/.test(t);
