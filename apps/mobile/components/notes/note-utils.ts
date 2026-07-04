import type { Note } from "@nox/types";

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
