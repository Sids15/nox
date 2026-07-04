/** Handoff tag palette — new tags cycle through these colors. */
export const TAG_PALETTE = ["#4C7FE0", "#2F9D72", "#A66BD9", "#C98A2B", "#D2604A", "#4AB3C4"];

export function nextTagColor(count: number): string {
  return TAG_PALETTE[count % TAG_PALETTE.length]!;
}
