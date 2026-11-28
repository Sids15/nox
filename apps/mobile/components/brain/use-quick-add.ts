import { parseQuickAdd, useCreateIdea, useCreateNote, useCreateResource, useCreateTask, useUpdateResource } from "@nox/features";
import { domainFrom, todayKey } from "@nox/utils";
import { fetchUrlMeta, videoThumbnail } from "../../lib/url-meta";

export type QuickKind = "task" | "idea" | "note" | "link";

/** The whole text is one web address (with or without https://). */
export const looksLikeUrl = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim());

/** The first http(s) address inside some shared text ("Watch this https://youtu.be/…"), or null. */
export const firstUrl = (s: string): string | null => s.match(/https?:\/\/[^\s<>"]+/i)?.[0] ?? null;

/**
 * Add one line to Nox: a task (understands "film intro friday 3pm"), an idea, a note title, or a link
 * (saved with its page title). Used by a space's Add box, the "Add to Nox" sheet and the widgets.
 */
export function useQuickAdd() {
  const createTask = useCreateTask();
  const createIdea = useCreateIdea();
  const createNote = useCreateNote();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();

  return async (raw: string, kind: QuickKind, where: { spaceId: string | null; stage?: string | null }): Promise<void> => {
    const text = raw.trim();
    if (!text) return;
    const space_id = where.spaceId;
    const stage = where.stage ?? null;
    if (kind === "link") {
      const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      const thumb = videoThumbnail(url) ?? null;
      const id = createResource.create({ type: thumb ? "video" : "link", url, title: null, domain: domainFrom(url), thumbnail_url: thumb, duration: null, body: null, tag_ids: [], space_id });
      const meta = await fetchUrlMeta(url);
      if (meta?.title || (meta?.image && !thumb)) updateResource.mutate({ id, patch: { title: meta.title ?? null, ...(meta.image && !thumb ? { thumbnail_url: meta.image } : {}) } });
    } else if (kind === "idea") {
      createIdea.create({ title: text.slice(0, 200), description: null, content: [], priority: "medium", status: "raw", tags: [], space_id, stage });
    } else if (kind === "note") {
      createNote.create({ title: text.slice(0, 200), type: "text", content: [{ type: "paragraph", text: "" }], folder_id: null, tags: [], space_id, stage });
    } else {
      const p = parseQuickAdd(text, todayKey());
      createTask.create({
        title: (p.title || text).slice(0, 200),
        notes: null,
        due_date: p.date ?? null,
        due_time: p.time ?? (p.tonight ? "20:00" : null),
        ...(p.duration ? { duration_minutes: p.duration } : {}),
        reminder_times: [],
        priority: p.priority ?? "medium",
        repeat: "none",
        repeat_config: null,
        space_id,
      });
    }
  };
}
