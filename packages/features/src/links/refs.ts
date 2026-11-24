import type { ContentBlock } from "@nox/types";

/** What a link between pages can point at. */
export const refKinds = ["note", "idea", "task", "resource"] as const;
export type RefKind = (typeof refKinds)[number];
export interface Ref {
  kind: RefKind;
  id: string;
}

const KIND_LABEL: Record<RefKind, string> = { note: "Note", idea: "Idea", task: "Task", resource: "Resource" };
export const refKindLabel = (kind: RefKind) => KIND_LABEL[kind];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `nox://note/<id>` — also the app's deep link, so a tapped link opens the page. */
export const refUrl = ({ kind, id }: Ref) => `nox://${kind}/${id}`;

/** The page a link block points at, or null for an ordinary web link. */
export function parseRef(url: string): Ref | null {
  const m = /^nox:\/\/(note|idea|task|resource)\/([^/?#]+)$/.exec(url.trim());
  if (!m || !UUID.test(m[2]!)) return null;
  return { kind: m[1] as RefKind, id: m[2]!.toLowerCase() };
}

/**
 * A link to another page, stored as an ordinary link block: older app versions (and anything else
 * reading the JSON) show it as a link card titled with the page's name instead of failing on an
 * unknown block type. The title is a snapshot; the app shows the page's current title.
 */
export function refBlock(ref: Ref, title: string): Extract<ContentBlock, { type: "link" }> {
  return { type: "link", url: refUrl(ref), title: title.slice(0, 1000) || null, domain: refKindLabel(ref.kind), thumbnail: null };
}

/** Every page a document links to, once each, in order. */
export function outgoingRefs(blocks: readonly ContentBlock[]): Ref[] {
  const seen = new Set<string>();
  const out: Ref[] = [];
  for (const b of blocks) {
    if (b.type !== "link") continue;
    const r = parseRef(b.url);
    if (!r) continue;
    const k = `${r.kind}:${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** A page that can link out (notes and ideas have block bodies). */
export interface LinkingPage {
  kind: RefKind;
  id: string;
  title: string;
  content: readonly ContentBlock[];
  updated_at: string;
}

/** Pages that link to `target`, most recently edited first, never the page itself. */
export function backlinks(target: Ref, pages: readonly LinkingPage[]): LinkingPage[] {
  return pages
    .filter((p) => !(p.kind === target.kind && p.id === target.id))
    .filter((p) => p.content.some((b) => b.type === "link" && parseRef(b.url)?.id === target.id && parseRef(b.url)?.kind === target.kind))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/**
 * The `[[` someone is typing at the end of a paragraph: the text after it, or null when the paragraph
 * doesn't end in an open `[[…`. The query stops at a newline or a closing bracket.
 */
export function openLinkQuery(text: string): string | null {
  const m = /\[\[([^\[\]\n]{0,80})$/.exec(text);
  return m ? m[1]! : null;
}

/** The paragraph with its trailing `[[query` removed (what's left once the link is chosen). */
export function withoutLinkQuery(text: string): string {
  return text.replace(/\[\[[^\[\]\n]{0,80}$/, "").replace(/[ \t]+$/, "");
}

/** A page that can be linked to. */
export interface LinkTarget {
  kind: RefKind;
  id: string;
  title: string;
  updated_at: string;
}

/**
 * Pages matching what's typed after `[[`: titles starting with it first, then titles containing it,
 * each most recently edited first. An empty query lists the most recent pages.
 */
export function matchTargets(query: string, targets: readonly LinkTarget[], limit = 8): LinkTarget[] {
  const q = query.trim().toLowerCase();
  const recent = [...targets].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  if (!q) return recent.slice(0, limit);
  const starts: LinkTarget[] = [];
  const contains: LinkTarget[] = [];
  for (const t of recent) {
    const title = t.title.toLowerCase();
    if (title.startsWith(q)) starts.push(t);
    else if (title.includes(q)) contains.push(t);
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * The `/command` someone is typing at the end of a paragraph (Notion-style): the word after the
 * slash, or null. Only at the start of the paragraph or after a space, so URLs and dates don't open it.
 */
export function openSlashQuery(text: string): string | null {
  const m = /(?:^|\s)\/([a-z]{0,20})$/i.exec(text);
  return m ? m[1]!.toLowerCase() : null;
}

/** The paragraph with its trailing `/command` removed. */
export function withoutSlashQuery(text: string): string {
  return text.replace(/(^|\s)\/[a-z]{0,20}$/i, "$1").replace(/[ \t]+$/, "");
}
