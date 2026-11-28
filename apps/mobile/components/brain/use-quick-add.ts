import { belongsInInbox, parseQuickAdd, useCreateIdea, useCreateNote, useCreateResource, useCreateTask, useUpdateResource } from "@nox/features";
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
 * With `inbox`, something with no space (and, for a task, no day) is marked for the Inbox.
 */
export function useQuickAdd() {
  const createTask = useCreateTask();
  const createIdea = useCreateIdea();
  const createNote = useCreateNote();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();

  return async (raw: string, kind: QuickKind, where: { spaceId: string | null; stage?: string | null; date?: string | null; time?: string | null; inbox?: boolean }): Promise<void> => {
    const text = raw.trim();
    if (!text) return;
    const space_id = where.spaceId;
    const stage = where.stage ?? null;
    // Captured from outside (share sheet, widgets): with no home yet, it waits in the Inbox.
    const inbox = !!where.inbox && belongsInInbox({ spaceId: space_id, date: where.date ?? null });
    const inInbox = inbox ? { inbox: true } : {};
    // On a day (from the calendar): a task is due then; an idea or note gets a Date field.
    const dated = where.date ? { properties: [{ id: `d${Date.now().toString(36)}`, name: "Date", type: "date" as const, value: where.date }] } : {};
    if (kind === "link") {
      const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
      const thumb = videoThumbnail(url) ?? null;
      const id = createResource.create({ type: thumb ? "video" : "link", url, title: null, domain: domainFrom(url), thumbnail_url: thumb, duration: null, body: null, tag_ids: [], space_id, ...inInbox });
      const meta = await fetchUrlMeta(url);
      if (meta?.title || (meta?.image && !thumb)) updateResource.mutate({ id, patch: { title: meta.title ?? null, ...(meta.image && !thumb ? { thumbnail_url: meta.image } : {}) } });
    } else if (kind === "idea") {
      createIdea.create({ title: text.slice(0, 200), description: null, content: [], priority: "medium", status: "raw", tags: [], space_id, stage, ...dated, ...inInbox });
    } else if (kind === "note") {
      createNote.create({ title: text.slice(0, 200), type: "text", content: [{ type: "paragraph", text: "" }], folder_id: null, tags: [], space_id, stage, ...dated, ...inInbox });
    } else {
      const p = parseQuickAdd(text, todayKey());
      const due = p.date ?? where.date ?? null;
      createTask.create({
        title: (p.title || text).slice(0, 200),
        notes: null,
        due_date: due,
        due_time: p.time ?? where.time ?? (p.tonight ? "20:00" : null),
        ...(p.duration ? { duration_minutes: p.duration } : {}),
        reminder_times: [],
        priority: p.priority ?? "medium",
        repeat: "none",
        repeat_config: null,
        space_id,
        // A task that got a day from its words ("… friday") already has a home.
        ...(inbox && !due ? { inbox: true } : {}),
      });
    }
  };
}
