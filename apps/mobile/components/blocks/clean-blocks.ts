import type { ContentBlock } from "@nox/types";

export const emptyDoc = (): ContentBlock[] => [{ type: "paragraph", text: "" }];

export const isText = (b: ContentBlock | undefined): b is Extract<ContentBlock, { type: "paragraph" | "heading" }> =>
  !!b && (b.type === "paragraph" || b.type === "heading");

/**
 * The persisted form of a block document:
 * - empty text blocks are trimmed;
 * - media that hasn't finished uploading is left out — its `localUri` (a `file://` path or a `blob:`
 *   URL) is dead on any other device and after a reload, so saving it produced voice notes and
 *   pictures that silently broke. It is saved the moment the upload fills in `storagePath`;
 * - `localUri` is dropped from uploaded media for the same reason.
 * Always keeps ≥1 block.
 */
export function cleanBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const kept = blocks
    .filter((b) => (isText(b) ? b.text.trim() !== "" : !("storagePath" in b) || !!b.storagePath))
    .map((b) => ("storagePath" in b && b.storagePath ? { ...b, localUri: null } : b));
  return kept.length ? kept : emptyDoc();
}

