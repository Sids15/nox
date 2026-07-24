import { describe, expect, test } from "bun:test";

import { classifySource, hostOf, isTrustedSource } from "./trusted-sources";

describe("classifySource", () => {
  test("YouTube watch URL → video with deterministic embed + thumbnail", () => {
    const r = classifySource("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r).toEqual({
      kind: "video",
      domain: "youtube.com",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
  });

  test("youtu.be short link and shorts resolve the same id", () => {
    expect(classifySource("https://youtu.be/dQw4w9WgXcQ")?.embedUrl).toContain("dQw4w9WgXcQ");
    expect(classifySource("https://youtube.com/shorts/dQw4w9WgXcQ")?.embedUrl).toContain("dQw4w9WgXcQ");
  });

  test("Vimeo → video with player embed", () => {
    expect(classifySource("https://vimeo.com/123456789")).toEqual({
      kind: "video",
      domain: "vimeo.com",
      embedUrl: "https://player.vimeo.com/video/123456789",
    });
  });

  test("GitHub → link (og:image via the proxy, no embed)", () => {
    expect(classifySource("https://github.com/nativewind/nativewind")).toEqual({
      kind: "link",
      domain: "github.com",
    });
  });

  test("subdomains of a trusted host are trusted", () => {
    expect(classifySource("https://gist.github.com/x/y")?.domain).toBe("github.com");
  });

  test("a bare domain (no scheme) still classifies", () => {
    expect(classifySource("github.com/foo")?.kind).toBe("link");
  });

  test("untrusted host → null (no preview at all)", () => {
    expect(classifySource("https://example.com/anything")).toBeNull();
    expect(isTrustedSource("https://example.com")).toBe(false);
  });

  test("suffix-collision hosts are NOT trusted", () => {
    // The whole point of the endsWith(".domain") guard.
    expect(classifySource("https://evil-github.com")).toBeNull();
    expect(classifySource("https://github.com.evil.com")).toBeNull();
    expect(classifySource("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  test("garbage input never throws", () => {
    expect(classifySource("not a url")).toBeNull();
    expect(hostOf("::::")).toBe("");
  });
});
