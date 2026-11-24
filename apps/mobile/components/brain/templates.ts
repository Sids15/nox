import type { ContentBlock, Property, PropertyType, TemplateInput } from "@nox/types";
import { toDateKey } from "@nox/utils";

/** A starting point for a page: built in (id "builtin:…") or one the user saved. */
export interface TemplateLike extends TemplateInput {
  id: string;
  builtIn: boolean;
}

const h = (text: string): ContentBlock => ({ type: "heading", level: 2, text });
const p = (text = ""): ContentBlock => ({ type: "paragraph", text });
const sections = (...titles: string[]): ContentBlock[] => titles.flatMap((t) => [h(t), p()]);
let seq = 0;
const field = (name: string, type: PropertyType, value: Property["value"] = null, options?: string[]): Property => ({
  id: `t${++seq}`,
  name,
  type,
  value,
  ...(options ? { options } : {}),
});

/** The starters every account has. Editable by saving a copy ("Save as template"). */
export const BUILT_IN_TEMPLATES: TemplateLike[] = [
  {
    id: "builtin:video",
    builtIn: true,
    name: "Video idea",
    kind: "idea",
    title: null,
    content: sections("Hook", "Title options", "Outline", "Thumbnail", "Sources"),
    properties: [
      field("Publish date", "date"),
      field("Format", "select", null, ["Long-form", "Short", "Live"]),
      field("Channel", "text"),
    ],
  },
  {
    id: "builtin:prd",
    builtIn: true,
    name: "PRD",
    kind: "note",
    title: null,
    content: sections("Problem", "Goals", "Non-goals", "Users", "Requirements", "Success metrics", "Open questions"),
    properties: [
      field("Status", "select", "Draft", ["Draft", "In review", "Approved", "Shipped"]),
      field("Owner", "text"),
      field("Target date", "date"),
    ],
  },
  {
    id: "builtin:project",
    builtIn: true,
    name: "Project brief",
    kind: "note",
    title: null,
    content: sections("Goal", "Why now", "Scope", "Milestones", "Risks", "Links"),
    properties: [
      field("Status", "select", "Planning", ["Planning", "Active", "Paused", "Done"]),
      field("Deadline", "date"),
      field("Link", "url"),
    ],
  },
  {
    id: "builtin:meeting",
    builtIn: true,
    name: "Meeting notes",
    kind: "note",
    title: null,
    content: sections("Agenda", "Notes", "Decisions", "Action items"),
    properties: [field("Date", "date"), field("Attendees", "text")],
  },
  {
    id: "builtin:decision",
    builtIn: true,
    name: "Decision log",
    kind: "note",
    title: null,
    content: sections("Context", "Options considered", "Decision", "Consequences"),
    properties: [field("Date", "date"), field("Status", "select", "Proposed", ["Proposed", "Decided", "Revisited"])],
  },
];

/**
 * What a page gets from a template: its body, and fresh copies of its fields (new ids, and today's
 * date in any empty date field named "Date", so meeting notes are dated the day they're taken).
 */
export function fromTemplate(t: TemplateInput, now = new Date()): { content: ContentBlock[]; properties: Property[]; title: string | null } {
  const stamp = Date.now().toString(36);
  return {
    title: t.title,
    content: t.content.length ? t.content : [p()],
    properties: t.properties.map((f, i) => ({
      ...f,
      id: `f${stamp}${i}`,
      value: f.type === "date" && f.value === null && f.name.toLowerCase() === "date" ? toDateKey(now) : f.value,
    })),
  };
}

/** A page's current body and fields as a template the user can reuse (field values cleared). */
export function toTemplate(name: string, kind: "note" | "idea", title: string | null, content: ContentBlock[], properties: Property[]): TemplateInput {
  return {
    name: name.trim().slice(0, 80) || "Untitled template",
    kind,
    title,
    content,
    properties: properties.map((f) => ({ ...f, value: f.type === "checkbox" ? false : f.type === "select" ? f.value : null })),
  };
}

/** True when a page has nothing in it yet (the moment to offer a template). */
export function isBlankPage(title: string, content: readonly ContentBlock[], properties: readonly Property[]): boolean {
  return (
    !title.trim() &&
    properties.length === 0 &&
    content.every((b) => (b.type === "paragraph" || b.type === "heading") && b.text.trim() === "")
  );
}
