/** Handoff tag palette — new tags cycle through these colors. */
export const TAG_PALETTE = ["#4C7FE0", "#2F9D72", "#A66BD9", "#C98A2B", "#D2604A", "#4AB3C4"];

export function nextTagColor(count: number): string {
  return TAG_PALETTE[count % TAG_PALETTE.length]!;
}

/** A free-text tag's colour, stable by name, so "#work" looks the same on every note and idea. */
export function tagColor(name: string): string {
  const key = name.replace(/^#/, "").toLowerCase();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

/** Normalise typed text into a tag: no leading #, trimmed, lower case, inner spaces as hyphens, ≤ 40 chars. */
export function cleanTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
}
