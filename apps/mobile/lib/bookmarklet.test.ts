import { describe, expect, test } from "bun:test";
import { bookmarkletBase, bookmarkletCode } from "./bookmarklet";

describe("bookmarkletCode", () => {
  test("opens this Nox's Add page with the page's address and title", () => {
    const code = bookmarkletCode("https://nox.example.com/");
    expect(code.startsWith("javascript:")).toBe(true);
    expect(code).toContain("'https://nox.example.com/add?url='+e(location.href)");
    expect(code).toContain("'&title='+e(document.title");
    expect(code).toContain("'&text='+e(s)");
  });

  test("is valid JavaScript", () => {
    const code = bookmarkletCode("https://nox.example.com");
    expect(() => new Function(code.slice("javascript:".length))).not.toThrow();
  });

  test("builds the right address when run on a page", () => {
    const opened: string[] = [];
    const run = new Function("location", "document", "getSelection", "window", "encodeURIComponent", bookmarkletCode("https://nox.example.com").slice(11));
    run(
      { href: "https://blog.example.com/post?a=1&b=2" },
      { title: "A post & more" },
      () => "  picked words ",
      { open: (u: string) => (opened.push(u), {}) },
      encodeURIComponent,
    );
    expect(opened).toEqual([
      "https://nox.example.com/add?url=https%3A%2F%2Fblog.example.com%2Fpost%3Fa%3D1%26b%3D2&title=A%20post%20%26%20more&text=picked%20words",
    ]);
  });
});

describe("bookmarkletBase", () => {
  test("prefers the configured address, else this page's origin", () => {
    expect(bookmarkletBase("https://app.nox.dev/", "http://localhost:8081")).toBe("https://app.nox.dev");
    expect(bookmarkletBase(undefined, "http://localhost:8081")).toBe("http://localhost:8081");
    expect(bookmarkletBase("", "https://nox.app")).toBe("https://nox.app");
  });

  test("no address it can open from a browser: null", () => {
    expect(bookmarkletBase(undefined, "tauri://localhost")).toBeNull();
    expect(bookmarkletBase(undefined, null)).toBeNull();
    expect(bookmarkletBase("https://x.com/'+alert(1)+'", null)).toBeNull();
  });
});
