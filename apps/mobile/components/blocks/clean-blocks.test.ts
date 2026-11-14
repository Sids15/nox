import { describe, expect, test } from "bun:test";
import type { ContentBlock } from "@nox/types";
import { cleanBlocks } from "./clean-blocks";

const p = (text: string): ContentBlock => ({ type: "paragraph", text });

describe("cleanBlocks", () => {
  test("drops empty text blocks but keeps one paragraph in an empty document", () => {
    expect(cleanBlocks([p(""), { type: "heading", level: 2, text: "  " }])).toEqual([p("")]);
    expect(cleanBlocks([p("a"), p(""), p("b")])).toEqual([p("a"), p("b")]);
  });

  test("leaves out media that hasn't finished uploading", () => {
    const pending: ContentBlock = { type: "audio", localUri: "blob:http://x/1", storagePath: null, durationMs: 3000 };
    expect(cleanBlocks([p("note"), pending])).toEqual([p("note")]);
  });

  test("keeps uploaded media without its device-local uri", () => {
    const done: ContentBlock = { type: "image", localUri: "file:///tmp/a.jpg", storagePath: "u/n/a.jpg", width: 10, height: 10 };
    expect(cleanBlocks([done])).toEqual([{ ...done, localUri: null }]);
  });

  test("keeps links, which have no upload", () => {
    const link: ContentBlock = { type: "link", url: "https://a.dev", title: null, domain: "a.dev", thumbnail: null };
    expect(cleanBlocks([link])).toEqual([link]);
  });
});
