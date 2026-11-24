import { useIdeas, useNotes, useResources, useSpaces, useTasks, type LinkTarget, type LinkingPage, type Ref, type RefKind } from "@nox/features";
import type { Idea, Note, Resource, Space, Task } from "@nox/types";
import { router } from "expo-router";
import { useMemo } from "react";
import { openExternal } from "../../lib/open-external";
import { noteTitle } from "../notes/note-utils";

export const resourceTitle = (r: Resource) => r.title?.trim() || r.domain || r.url || "Untitled resource";
export const ideaTitle = (i: Idea) => i.title.trim() || "Untitled idea";

/** Any page in the second brain, with what lists and links need to show it. */
export interface Page extends LinkTarget {
  space_id: string | null;
  /** Archived, dropped or completed: still linkable, shown dimmed. */
  done: boolean;
}

export type PageSource =
  | { kind: "note"; item: Note }
  | { kind: "idea"; item: Idea }
  | { kind: "task"; item: Task }
  | { kind: "resource"; item: Resource };

/**
 * Every note, idea, task and resource as one index: for the `[[` picker, link cards (live titles),
 * "Linked from" and space pages. Built from the lists the app already holds, so it costs no requests.
 */
export function usePages() {
  const { data: notes = [] } = useNotes();
  const { data: ideas = [] } = useIdeas();
  const { data: tasks = [] } = useTasks();
  const { data: resources = [] } = useResources();
  const { data: spaces = [] } = useSpaces();

  return useMemo(() => {
    const pages: Page[] = [
      ...notes.map((n) => ({ kind: "note" as const, id: n.id, title: noteTitle(n), updated_at: n.updated_at, space_id: n.space_id, done: n.is_archived })),
      ...ideas.map((i) => ({
        kind: "idea" as const,
        id: i.id,
        title: ideaTitle(i),
        updated_at: i.updated_at,
        space_id: i.space_id,
        done: i.is_archived || i.status === "dropped",
      })),
      // Recurring occurrences share their template's title; link to the template, not each copy.
      ...tasks
        .filter((t) => !t.deleted && t.origin_task_id === null)
        .map((t) => ({ kind: "task" as const, id: t.id, title: t.title, updated_at: t.updated_at, space_id: t.space_id, done: t.status === "complete" })),
      ...resources.map((r) => ({
        kind: "resource" as const,
        id: r.id,
        title: resourceTitle(r),
        updated_at: r.updated_at,
        space_id: r.space_id,
        done: r.is_archived,
      })),
    ];
    const byKey = new Map(pages.map((p) => [`${p.kind}:${p.id}`, p]));
    const linking: LinkingPage[] = [
      ...notes.map((n) => ({ kind: "note" as const, id: n.id, title: noteTitle(n), content: n.content, updated_at: n.updated_at })),
      ...ideas.map((i) => ({ kind: "idea" as const, id: i.id, title: ideaTitle(i), content: i.content, updated_at: i.updated_at })),
    ];
    const spaceById = new Map<string, Space>(spaces.map((s) => [s.id, s]));
    return {
      pages,
      linking,
      spaces,
      spaceById,
      find: (ref: Ref) => byKey.get(`${ref.kind}:${ref.id}`),
      resource: (id: string) => resources.find((r) => r.id === id),
      notes,
      ideas,
      tasks,
      resources,
    };
  }, [notes, ideas, tasks, resources, spaces]);
}

/** Open a linked page: its editor, or (for a resource) the saved link itself. */
export function openRef(ref: Ref, resource?: Resource): void {
  switch (ref.kind) {
    case "note":
      router.push(`/note/${ref.id}`);
      return;
    case "idea":
      router.push(`/idea/${ref.id}`);
      return;
    case "task":
      router.push(`/task/${ref.id}`);
      return;
    case "resource":
      if (resource?.url) void openExternal(resource.url);
      else router.navigate("/(tabs)/resources" as never);
      return;
  }
}

export const KIND_ORDER: RefKind[] = ["note", "idea", "task", "resource"];
