import type { Note } from "@nox/types";
import { formatTime12 } from "@nox/utils";

/** Display title: the note's title, else its first non-empty text block, else a placeholder. */
export function noteTitle(note: Note): string {
  if (note.title?.trim()) return note.title.trim();
  const firstText = note.content.find(
    (b) => (b.type === "paragraph" || b.type === "heading") && b.text.trim() !== "",
  );
  if (firstText && "text" in firstText) return firstText.text.trim().slice(0, 80);
  return "Untitled note";
}

/** One-line preview from the first paragraph (or a type label for media notes). */
export function notePreview(note: Note): string {
  const para = note.content.find((b) => b.type === "paragraph" && b.text.trim() !== "");
  if (para && "text" in para) return para.text.trim();
  if (note.type === "voice") return "Voice note";
  if (note.type === "sketch") return "Sketch";
  return "No additional text";
}

/** True if the note matches a search needle across title, block text, and tags. */
export function noteMatches(note: Note, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (note.title?.toLowerCase().includes(needle)) return true;
  if (note.tags.some((t) => t.toLowerCase().includes(needle))) return true;
  return note.content.some((b) => "text" in b && b.text.toLowerCase().includes(needle));
}

/**
 * Up to ~160 characters of the note's text for a two-line preview, skipping whatever the title
 * already shows (an untitled note's title is its first line).
 */
export function noteBody(note: Note): string {
  const title = noteTitle(note);
  const texts = note.content
    .filter((b) => (b.type === "paragraph" || b.type === "heading") && "text" in b && b.text.trim() !== "")
    .map((b) => ("text" in b ? b.text.trim().replace(/\s+/g, " ") : ""));
  if (!note.title?.trim() && texts[0] && title === texts[0].slice(0, 80)) texts.shift();
  return texts.join(" · ").slice(0, 160);
}

/** What a note contains besides text, for the row's small markers. */
export function noteMedia(note: Note): { voice: boolean; image: boolean; link: boolean } {
  return {
    voice: note.type === "voice" || note.content.some((b) => b.type === "audio"),
    image: note.content.some((b) => b.type === "image"),
    link: note.content.some((b) => b.type === "link"),
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "3:40 PM" today, "Yesterday", a weekday this week, else "2 Nov" (with the year if not this one). */
export function noteWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return formatTime12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`)!;
  if (days === 1) return "Yesterday";
  if (days < 7) return DAYS[d.getDay()]!;
  return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}${d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`}`;
}

/**
 * Notes grouped by when they were last edited, newest first: Today, Yesterday, Previous 7 days,
 * Previous 30 days, then by month this year and by year before that (as Apple Notes does).
 */
export function groupNotesByDate(notes: Note[], now = new Date()): { label: string; notes: Note[] }[] {
  const groups: { label: string; notes: Note[] }[] = [];
  const sorted = [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  for (const n of sorted) {
    const d = new Date(n.updated_at);
    const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
    const label =
      days <= 0
        ? "Today"
        : days === 1
          ? "Yesterday"
          : days < 7
            ? "Previous 7 days"
            : days < 30
              ? "Previous 30 days"
              : d.getFullYear() === now.getFullYear()
                ? MONTHS[d.getMonth()]!
                : String(d.getFullYear());
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.notes.push(n);
    else groups.push({ label, notes: [n] });
  }
  return groups;
}

/** Just the time a note was edited ("3:40 PM"), for lists whose heading already names the day. */
export function noteTime(iso: string): string {
  const d = new Date(iso);
  return formatTime12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`)!;
}
