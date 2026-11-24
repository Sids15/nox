import { describe, expect, test } from "bun:test";
import type { ContentBlock } from "@nox/types";
import {
  backlinks,
  matchTargets,
  openLinkQuery,
  outgoingRefs,
  parseRef,
  refBlock,
  refUrl,
  withoutLinkQuery,
  openSlashQuery,
  withoutSlashQuery,
  type LinkingPage,
} from "./refs";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("refs", () => {
  test("round-trips a page link and ignores web links", () => {
    expect(parseRef(refUrl({ kind: "note", id: A }))).toEqual({ kind: "note", id: A });
    expect(parseRef("https://example.com/note/" + A)).toBeNull();
    expect(parseRef("nox://note/not-a-uuid")).toBeNull();
    expect(parseRef("nox://folder/" + A)).toBeNull();
    expect(parseRef("nox://auth-callback")).toBeNull();
  });

  test("a link block reads as an ordinary link card", () => {
    expect(refBlock({ kind: "idea", id: B }, "Video: Rust in 100s")).toEqual({
      type: "link",
      url: `nox://idea/${B}`,
      title: "Video: Rust in 100s",
      domain: "Idea",
      thumbnail: null,
    });
  });

  test("outgoing links are listed once each", () => {
    const blocks: ContentBlock[] = [
      { type: "paragraph", text: "hi" },
      refBlock({ kind: "note", id: A }, "A"),
      { type: "link", url: "https://x.com", title: null, domain: "x.com", thumbnail: null },
      refBlock({ kind: "note", id: A }, "A again"),
      refBlock({ kind: "task", id: B }, "B"),
    ];
    expect(outgoingRefs(blocks)).toEqual([
      { kind: "note", id: A },
      { kind: "task", id: B },
    ]);
  });

  test("backlinks find the pages pointing here, newest first, never itself", () => {
    const page = (id: string, links: string[], updated: string): LinkingPage => ({
      kind: "note",
      id,
      title: id,
      updated_at: updated,
      content: links.map((l) => refBlock({ kind: "note", id: l }, l)),
    });
    const pages = [page(A, [A, B], "2026-01-01"), page(B, [], "2026-01-02"), page(C, [A], "2026-01-03")];
    expect(backlinks({ kind: "note", id: A }, pages).map((p) => p.id)).toEqual([C]);
    expect(backlinks({ kind: "note", id: B }, pages).map((p) => p.id)).toEqual([A]);
    expect(backlinks({ kind: "idea", id: B }, pages)).toEqual([]);
  });

  test("[[ typing is detected only while open", () => {
    expect(openLinkQuery("see [[Pri")).toBe("Pri");
    expect(openLinkQuery("see [[")).toBe("");
    expect(openLinkQuery("see [[Pricing]] ok")).toBeNull();
    expect(openLinkQuery("see [[a\nb")).toBeNull();
    expect(openLinkQuery("plain")).toBeNull();
    expect(withoutLinkQuery("see [[Pri")).toBe("see");
    expect(withoutLinkQuery("[[")).toBe("");
  });

  test("targets: prefix matches before substring matches, recent first", () => {
    const t = (id: string, title: string, updated_at: string) => ({ kind: "note" as const, id, title, updated_at });
    const all = [t("1", "Old pricing", "2026-01-01"), t("2", "Pricing page", "2026-01-02"), t("3", "Thumbnails", "2026-01-03")];
    expect(matchTargets("pric", all).map((x) => x.id)).toEqual(["2", "1"]);
    expect(matchTargets("", all).map((x) => x.id)).toEqual(["3", "2", "1"]);
  });
});

describe("slash commands", () => {
  test("open only at the start or after a space", () => {
    expect(openSlashQuery("/")).toBe("");
    expect(openSlashQuery("/head")).toBe("head");
    expect(openSlashQuery("notes /img")).toBe("img");
    expect(openSlashQuery("https://x.com/a")).toBeNull();
    expect(openSlashQuery("1/2")).toBeNull();
    expect(openSlashQuery("/head ing")).toBeNull();
    expect(withoutSlashQuery("notes /img")).toBe("notes");
    expect(withoutSlashQuery("/h")).toBe("");
  });
});
