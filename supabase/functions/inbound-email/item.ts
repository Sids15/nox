// Reading one forwarded email into one Inbox item. Pure, so it's unit-tested; index.ts parses the
// MIME message and does the database work.

/** The secret part of a Nox address: the local part, 20 × [a-z0-9]. Null for anything else. */
export function tokenFrom(address: string, domain: string): string | null {
  const m = address.trim().toLowerCase().match(/^<?([a-z0-9]{20})(?:\+[^@]*)?@([^>\s]+)>?$/);
  if (!m) return null;
  return m[2] === domain.trim().toLowerCase() ? m[1]! : null;
}

/** The bare address in "Name <me@x.com>" (lower-case), or null. */
export function bareAddress(from: string): string | null {
  const m = from.match(/<([^<>\s@]+@[^<>\s@]+)>/) ?? from.match(/([^<>\s@"]+@[^<>\s@"]+)/);
  return m ? m[1]!.toLowerCase() : null;
}

/** Forwarded / replied prefixes, any number of times: "Fwd: Re: Fw: Plan" → "Plan". */
export function cleanSubject(subject: string): string {
  let s = subject.replace(/\s+/g, " ").trim();
  for (;;) {
    const next = s.replace(/^(?:re|fwd?|fw|aw|wg|tr)\s*:\s*/i, "");
    if (next === s) return s;
    s = next;
  }
}

/** The body worth keeping: text before the signature / quoted reply, collapsed. */
export function cleanBody(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^--\s?$/.test(line)) break; // signature
    if (/^On .+ wrote:$/.test(line.trim())) break; // a reply's quote header
    if (/^-{3,}\s*(Forwarded|Original) message\s*-{3,}$/i.test(line.trim())) continue;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;

export type InboundItem = { kind: "task"; title: string; notes: string | null } | { kind: "link"; url: string; title: string | null };

/**
 * What an email becomes: a link when it's just a link (a subject-less email holding one address, or
 * a subject that is one), otherwise a task named by the subject (or the first line) with the body as
 * its notes.
 */
export function emailToItem(subject: string, text: string): InboundItem | null {
  const s = cleanSubject(subject);
  const body = cleanBody(text);
  const subjectUrl = s.match(URL_RE)?.[0];
  if (subjectUrl && s === subjectUrl) return { kind: "link", url: subjectUrl.slice(0, 4000), title: null };
  const onlyUrl = body.match(/^\s*(https?:\/\/[^\s<>"]+)\s*$/i)?.[1];
  if (!s && onlyUrl) return { kind: "link", url: onlyUrl.slice(0, 4000), title: null };
  if (s && onlyUrl) return { kind: "link", url: onlyUrl.slice(0, 4000), title: s.slice(0, 1000) };
  const firstLine = body.split("\n").find((l) => l.trim())?.trim() ?? "";
  const title = (s || firstLine).slice(0, 200);
  if (!title) return null;
  const notes = s ? body : body.split("\n").slice(1).join("\n").trim();
  return { kind: "task", title, notes: notes ? notes.slice(0, 2000) : null };
}
