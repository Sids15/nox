import type { Idea, Note, Resource, Task } from "@nox/types";

/** One thing waiting in the Inbox. */
export interface InboxItem {
  kind: "task" | "note" | "idea" | "resource";
  id: string;
  title: string;
  created_at: string;
}

export interface InboxSource {
  tasks: Task[];
  notes: Note[];
  ideas: Idea[];
  resources: Resource[];
}

const firstLine = (n: Note) =>
  n.title?.trim() ||
  n.content.map((b) => ("text" in b ? b.text.trim() : "")).find(Boolean)?.slice(0, 80) ||
  "Untitled note";

/**
 * What's waiting to be sorted: everything marked `inbox` that's still live (not deleted, archived,
 * done or dropped), newest first. A captured thing leaves when it's given a day or a space, kept as
 * it is, or finished.
 */
export function inboxItems({ tasks, notes, ideas, resources }: InboxSource): InboxItem[] {
  const out: InboxItem[] = [];
  for (const t of tasks) {
    if (t.inbox && !t.deleted && t.status === "pending") out.push({ kind: "task", id: t.id, title: t.title, created_at: t.created_at });
  }
  for (const n of notes) {
    if (n.inbox && !n.deleted && !n.is_archived) out.push({ kind: "note", id: n.id, title: firstLine(n), created_at: n.created_at });
  }
  for (const i of ideas) {
    if (i.inbox && !i.deleted && !i.is_archived && i.status !== "dropped") out.push({ kind: "idea", id: i.id, title: i.title || "Untitled idea", created_at: i.created_at });
  }
  for (const r of resources) {
    if (r.inbox && !r.deleted && !r.is_archived) out.push({ kind: "resource", id: r.id, title: r.title?.trim() || r.domain || r.url || "Link", created_at: r.created_at });
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

/** Whether a capture should land in the Inbox: it has no home yet (no space, and for a task no day). */
export function belongsInInbox(where: { spaceId: string | null; date?: string | null }): boolean {
  return !where.spaceId && !where.date;
}

/**
 * An edit that gives an Inbox item a home (a day, a space, a folder) also takes it out of the Inbox.
 * Only items already marked are touched, so a database without the column is never sent it.
 */
export function withInboxExit<V extends { id: string; patch: object }>(
  current: { inbox?: boolean } | undefined,
  vars: V,
  homeKeys: readonly string[],
): V {
  if (!current?.inbox) return vars;
  const patch = vars.patch as Record<string, unknown>;
  if ("inbox" in patch || !homeKeys.some((k) => patch[k] != null)) return vars;
  return { ...vars, patch: { ...patch, inbox: false } };
}
