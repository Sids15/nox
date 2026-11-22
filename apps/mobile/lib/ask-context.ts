/**
 * Ask Nox picks what to send the AI on the device, for free: a plain keyword ranking over the user's
 * notes, ideas, resources and tasks. Only the best few items go out, each cut short — so a question
 * costs one small request, and nothing unrelated leaves the device.
 */

export interface AskItem {
  id: string;
  kind: "note" | "idea" | "resource" | "task";
  title: string;
  text: string;
}

const STOP = new Set(
  "the and for are was were what when where which who why how did does have has had with this that from into about your you our out not but can any all its it's i'm my me we they them then than there their just get got make made some more most much very will would should could been being over also only".split(
    " ",
  ),
);

/** Lower-case words worth matching on (3+ letters, not filler); keeps numbers. */
export function terms(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => (w.length >= 3 || /^\d+$/.test(w)) && !STOP.has(w)),
    ),
  ];
}

/**
 * The `limit` items that best match `question`: a word in the title counts three times as much as
 * one in the text, a crude stem match ("plan" ~ "planning") counts half. Items with no match are
 * left out. Each item's text is cut to `maxChars`.
 */
export function rankContext(question: string, items: AskItem[], limit = 12, maxChars = 700): AskItem[] {
  const q = terms(question);
  if (q.length === 0) return [];
  const scored: { item: AskItem; score: number }[] = [];
  for (const item of items) {
    const title = item.title.toLowerCase();
    const text = item.text.toLowerCase();
    let score = 0;
    for (const w of q) {
      const stem = w.length > 5 ? w.slice(0, w.length - 2) : w;
      if (title.includes(w)) score += 3;
      else if (title.includes(stem)) score += 1.5;
      if (text.includes(w)) score += 1;
      else if (text.includes(stem)) score += 0.5;
    }
    if (score > 0) scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => ({ ...item, title: item.title.slice(0, 160), text: item.text.replace(/\s+/g, " ").slice(0, maxChars) }));
}
