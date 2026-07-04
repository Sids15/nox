import type { ContentBlock } from "@nox/types";
import { domainFrom } from "@nox/utils";
import { useEffect, useState } from "react";
import { fetchUrlMeta } from "../../lib/url-meta";

const emptyDoc = (): ContentBlock[] => [{ type: "paragraph", text: "" }];
const seed = (blocks: ContentBlock[]): ContentBlock[] => (blocks.length ? blocks : emptyDoc());

/** Trim empty text blocks for persistence; keep all media/link blocks and ≥1 block. */
export function cleanBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const kept = blocks.filter(
    (b) => (b.type !== "paragraph" && b.type !== "heading") || b.text.trim() !== "",
  );
  return kept.length ? kept : emptyDoc();
}

/**
 * Local block-editing state for the shared BlockEditor. Seeds from `initial` (re-seeds when
 * `containerId` changes, i.e. a different note/idea), and reports every edit via `onChange` (the
 * screen debounces the actual save). Media inserts (image/audio) come from Stages B/C.
 */
export function useBlockEditor(
  containerId: string,
  initial: ContentBlock[],
  onChange: (blocks: ContentBlock[]) => void,
) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => seed(initial));

  // Re-seed only when switching documents (not on every autosave refetch).
  useEffect(() => {
    setBlocks(seed(initial));
  }, [containerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: ContentBlock[]) => {
    setBlocks(next);
    onChange(cleanBlocks(next));
  };

  return {
    blocks,
    setText: (i: number, text: string) =>
      commit(blocks.map((b, j) => (j === i && "text" in b ? { ...b, text } : b))),
    addParagraph: () => commit([...blocks, { type: "paragraph", text: "" }]),
    addHeading: () => commit([...blocks, { type: "heading", level: 2, text: "" }]),
    addLink: async (rawUrl: string) => {
      const url = rawUrl.trim();
      if (!url) return;
      const block: ContentBlock = {
        type: "link",
        url: url.startsWith("http") ? url : `https://${url}`,
        title: null,
        domain: domainFrom(url),
        thumbnail: null,
      };
      commit([...blocks, block]);
      const meta = await fetchUrlMeta(url);
      if (meta) {
        setBlocks((prev) => {
          const next = prev.map((b) =>
            b.type === "link" && b.url === block.url
              ? { ...b, title: meta.title ?? null, domain: meta.domain, thumbnail: meta.image ?? null }
              : b,
          );
          onChange(cleanBlocks(next));
          return next;
        });
      }
    },
    insertMedia: (block: ContentBlock) => commit([...blocks, block]),
    patchMedia: (match: (b: ContentBlock) => boolean, patch: Partial<ContentBlock>) =>
      setBlocks((prev) => {
        const next = prev.map((b) => (match(b) ? ({ ...b, ...patch } as ContentBlock) : b));
        onChange(cleanBlocks(next));
        return next;
      }),
    removeBlock: (i: number) => commit(blocks.filter((_, j) => j !== i)),
  };
}
