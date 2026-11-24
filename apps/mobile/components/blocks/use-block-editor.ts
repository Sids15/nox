import { withoutLinkQuery, withoutSlashQuery } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { domainFrom } from "@nox/utils";
import { useEffect, useRef, useState } from "react";
import { fetchUrlMeta } from "../../lib/url-meta";
import { cleanBlocks, emptyDoc, isText } from "./clean-blocks";

export { cleanBlocks };

const seed = (blocks: ContentBlock[]): ContentBlock[] => (blocks.length ? blocks : emptyDoc());

let keySeq = 0;
const newKey = () => `b${++keySeq}`;

export interface BlockEditor {
  blocks: ContentBlock[];
  /** Stable React keys, parallel to `blocks` (indexes shift when blocks are inserted or removed). */
  keys: string[];
  /** The block the caret should move to, and where: set after inserts, merges and deletes. */
  focusTarget: { index: number; at: "start" | "end"; seq: number } | null;
  /** Index of the text block the caret is in (or was in last), for inserting at the cursor. */
  setFocused: (i: number) => void;
  setText: (i: number, text: string) => void;
  /** Enter at the end of a heading → a new paragraph after it. */
  splitAfter: (i: number) => void;
  /** Backspace in an empty block → remove it and move to the end of the previous text block. */
  backspaceEmpty: (i: number) => void;
  addParagraph: () => void;
  addHeading: () => void;
  addLink: (url: string) => Promise<void>;
  insertMedia: (block: ContentBlock) => void;
  patchMedia: (match: (b: ContentBlock) => boolean, patch: Partial<ContentBlock>) => void;
  dropMedia: (match: (b: ContentBlock) => boolean) => void;
  removeBlock: (i: number) => void;
  /** Tap below the document: focus the last text block, adding a paragraph if it ends in media. */
  focusEnd: () => void;
  /** Dictated text: appended to the block holding the caret, or a new paragraph there. */
  insertText: (text: string) => void;
  /** Swap the whole document (AI tidy / summary), saving it. */
  replaceAll: (blocks: ContentBlock[]) => void;
  /** Finish a `[[` in paragraph `i`: drop the typed query and put the page link after it. */
  linkPage: (i: number, link: ContentBlock) => void;
  /** Start a page link at the caret (the toolbar button): types `[[` so the picker opens. */
  startLink: () => void;
  /** A `/` command chosen in paragraph `i`: drop the typed `/word`, then do it. */
  slash: (i: number, command: "heading" | "text" | "page") => void;
}

/**
 * Editing state for the block editor (notes and ideas). Seeds from `initial` and re-seeds only when
 * `containerId` changes (a different note), never on autosave refetches. Every change goes through a
 * functional update so fast typing can't drop characters, and reports the cleaned document through
 * `onChange` (the screen debounces the save).
 *
 * Inserts land after the block holding the caret, not at the end of the document, and move the
 * caret into the new block — so "Text" and "Heading" visibly do something, and you can keep typing
 * after a picture or a voice note.
 */
export function useBlockEditor(
  containerId: string,
  initial: ContentBlock[],
  onChange: (blocks: ContentBlock[]) => void,
): BlockEditor {
  const [doc, setDoc] = useState(() => {
    const blocks = seed(initial);
    return { blocks, keys: blocks.map(newKey) };
  });
  const [focusTarget, setFocusTarget] = useState<BlockEditor["focusTarget"]>(null);
  const focused = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const seqRef = useRef(0);

  useEffect(() => {
    const blocks = seed(initial);
    setDoc({ blocks, keys: blocks.map(newKey) });
    focused.current = null;
    setFocusTarget(null);
  }, [containerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusAt = (index: number, at: "start" | "end" = "end") => {
    focused.current = index;
    setFocusTarget({ index, at, seq: ++seqRef.current });
  };

  /** Apply an edit. `persist: false` for changes that don't alter the saved document. */
  const update = (fn: (d: { blocks: ContentBlock[]; keys: string[] }) => { blocks: ContentBlock[]; keys: string[] }) => {
    setDoc((prev) => {
      const next = fn(prev);
      if (next !== prev) onChangeRef.current(cleanBlocks(next.blocks));
      return next;
    });
  };

  /** Where an insert goes: right after the focused block, else at the end. */
  const insertIndex = (len: number) => (focused.current === null ? len : Math.min(focused.current + 1, len));

  const insertAt = (index: number, items: ContentBlock[]) =>
    update(({ blocks, keys }) => ({
      blocks: [...blocks.slice(0, index), ...items, ...blocks.slice(index)],
      keys: [...keys.slice(0, index), ...items.map(newKey), ...keys.slice(index)],
    }));

  /** Insert a text block at the caret, or turn the current empty block into it. */
  const addText = (kind: "paragraph" | "heading") => {
    const cur = focused.current === null ? undefined : doc.blocks[focused.current];
    if (isText(cur) && cur.text === "" && cur.type !== kind) {
      const i = focused.current!;
      update(({ blocks, keys }) => ({
        blocks: blocks.map((b, j) => (j === i ? (kind === "heading" ? { type: "heading", level: 2, text: "" } : { type: "paragraph", text: "" }) : b)),
        keys,
      }));
      focusAt(i);
      return;
    }
    if (isText(cur) && cur.text === "" && cur.type === kind) {
      focusAt(focused.current!);
      return;
    }
    const at = insertIndex(doc.blocks.length);
    insertAt(at, [kind === "heading" ? { type: "heading", level: 2, text: "" } : { type: "paragraph", text: "" }]);
    focusAt(at);
  };

  /** Media goes after the caret, followed by an empty paragraph to keep writing in if none is there. */
  const placeMedia = (block: ContentBlock) => {
    const at = insertIndex(doc.blocks.length);
    const after = doc.blocks[at];
    const needsTrailing = !isText(after);
    insertAt(at, needsTrailing ? [block, { type: "paragraph", text: "" }] : [block]);
    focused.current = at + 1;
  };

  return {
    blocks: doc.blocks,
    keys: doc.keys,
    focusTarget,
    setFocused: (i) => {
      focused.current = i;
    },
    setText: (i, text) =>
      update((d) => {
        const b = d.blocks[i];
        if (!isText(b) || b.text === text) return d;
        return { blocks: d.blocks.map((x, j) => (j === i ? { ...b, text } : x)), keys: d.keys };
      }),
    splitAfter: (i) => {
      insertAt(i + 1, [{ type: "paragraph", text: "" }]);
      focusAt(i + 1, "start");
    },
    backspaceEmpty: (i) => {
      if (doc.blocks.length <= 1) return;
      // Previous text block to land in (skipping media), else the next one.
      let target = -1;
      for (let j = i - 1; j >= 0; j--) if (isText(doc.blocks[j])) { target = j; break; }
      update(({ blocks, keys }) => ({ blocks: blocks.filter((_, j) => j !== i), keys: keys.filter((_, j) => j !== i) }));
      if (target >= 0) focusAt(target, "end");
      else focused.current = null;
    },
    addParagraph: () => addText("paragraph"),
    addHeading: () => addText("heading"),
    addLink: async (rawUrl) => {
      const url = rawUrl.trim();
      if (!url) return;
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      placeMedia({ type: "link", url: href, title: null, domain: domainFrom(href), thumbnail: null });
      const meta = await fetchUrlMeta(href);
      if (meta)
        update((d) => ({
          blocks: d.blocks.map((b) =>
            b.type === "link" && b.url === href && !b.title
              ? { ...b, title: meta.title ?? null, domain: meta.domain ?? b.domain, thumbnail: meta.image ?? null }
              : b,
          ),
          keys: d.keys,
        }));
    },
    insertMedia: placeMedia,
    patchMedia: (match, patch) =>
      update((d) => ({ blocks: d.blocks.map((b) => (match(b) ? ({ ...b, ...patch } as ContentBlock) : b)), keys: d.keys })),
    dropMedia: (match) =>
      update((d) => {
        const keep = d.blocks.map((b) => !match(b));
        const blocks = d.blocks.filter((_, j) => keep[j]);
        return blocks.length ? { blocks, keys: d.keys.filter((_, j) => keep[j]) } : { blocks: emptyDoc(), keys: [newKey()] };
      }),
    removeBlock: (i) =>
      update(({ blocks, keys }) => {
        const nb = blocks.filter((_, j) => j !== i);
        return nb.length ? { blocks: nb, keys: keys.filter((_, j) => j !== i) } : { blocks: emptyDoc(), keys: [newKey()] };
      }),
    insertText: (text) => {
      const i = focused.current;
      const cur = i === null ? undefined : doc.blocks[i];
      if (i !== null && isText(cur)) {
        update((d) => {
          const b = d.blocks[i];
          if (!isText(b)) return d;
          const sep = b.text === "" || /\s$/.test(b.text) ? "" : " ";
          const piece = b.text === "" || /[.!?]\s*$/.test(b.text) ? text.charAt(0).toUpperCase() + text.slice(1) : text;
          return { blocks: d.blocks.map((x, j) => (j === i ? { ...b, text: b.text + sep + piece } : x)), keys: d.keys };
        });
        focusAt(i, "end");
      } else {
        const at = insertIndex(doc.blocks.length);
        insertAt(at, [{ type: "paragraph", text: text.charAt(0).toUpperCase() + text.slice(1) }]);
        focusAt(at, "end");
      }
    },
    linkPage: (i, link) => {
      const b = doc.blocks[i];
      if (!isText(b)) return;
      const text = withoutLinkQuery(b.text);
      const after = doc.blocks[i + 1];
      const trailing: ContentBlock[] = isText(after) ? [] : [{ type: "paragraph", text: "" }];
      if (text === "" && b.type === "paragraph") {
        // Nothing else on the line: the link takes its place.
        update(({ blocks, keys }) => ({
          blocks: [...blocks.slice(0, i), link, ...trailing, ...blocks.slice(i + 1)],
          keys: [...keys.slice(0, i), newKey(), ...trailing.map(newKey), ...keys.slice(i + 1)],
        }));
        focusAt(i + 1, "start");
        return;
      }
      update(({ blocks, keys }) => ({
        blocks: [...blocks.slice(0, i), { ...b, text }, link, ...trailing, ...blocks.slice(i + 1)],
        keys: [...keys.slice(0, i + 1), newKey(), ...trailing.map(newKey), ...keys.slice(i + 1)],
      }));
      focusAt(i + 2, "start");
    },
    startLink: () => {
      const i = focused.current;
      const cur = i === null ? undefined : doc.blocks[i];
      if (i !== null && cur?.type === "paragraph") {
        update((d) => {
          const b = d.blocks[i];
          if (b?.type !== "paragraph") return d;
          const sep = b.text === "" || /\s$/.test(b.text) ? "" : " ";
          return { blocks: d.blocks.map((x, j) => (j === i ? { ...b, text: `${b.text}${sep}[[` } : x)), keys: d.keys };
        });
        focusAt(i, "end");
      } else {
        const at = insertIndex(doc.blocks.length);
        insertAt(at, [{ type: "paragraph", text: "[[" }]);
        focusAt(at, "end");
      }
    },
    slash: (i, command) => {
      const b = doc.blocks[i];
      if (b?.type !== "paragraph") return;
      const text = withoutSlashQuery(b.text);
      if (command === "page") {
        const sep = text === "" || /\s$/.test(text) ? "" : " ";
        update((d) => ({ blocks: d.blocks.map((x, j) => (j === i ? { type: "paragraph", text: `${text}${sep}[[` } : x)), keys: d.keys }));
        focusAt(i, "end");
        return;
      }
      const fresh: ContentBlock = command === "heading" ? { type: "heading", level: 2, text: "" } : { type: "paragraph", text: "" };
      if (text === "") {
        // An empty line becomes the block asked for.
        update((d) => ({ blocks: d.blocks.map((x, j) => (j === i ? fresh : x)), keys: d.keys }));
        focusAt(i, "start");
      } else {
        update(({ blocks, keys }) => ({
          blocks: [...blocks.slice(0, i), { ...b, text }, fresh, ...blocks.slice(i + 1)],
          keys: [...keys.slice(0, i + 1), newKey(), ...keys.slice(i + 1)],
        }));
        focusAt(i + 1, "start");
      }
    },
    replaceAll: (blocks) => {
      const next = seed(blocks);
      update(() => ({ blocks: next, keys: next.map(newKey) }));
      focused.current = null;
    },
    focusEnd: () => {
      const last = doc.blocks.length - 1;
      if (isText(doc.blocks[last])) focusAt(last, "end");
      else {
        insertAt(doc.blocks.length, [{ type: "paragraph", text: "" }]);
        focusAt(last + 1);
      }
    },
  };
}
