import { describe, expect, test } from "bun:test";
import { bareAddress, cleanBody, cleanSubject, emailToItem, tokenFrom } from "./item";

const T = "ab12cd34ef56gh78ij90";

describe("tokenFrom", () => {
  test("the 20-character local part on our domain only", () => {
    expect(tokenFrom(`${T}@in.nox.app`, "in.nox.app")).toBe(T);
    expect(tokenFrom(`<${T.toUpperCase()}@IN.NOX.APP>`, "in.nox.app")).toBe(T);
    expect(tokenFrom(`${T}+work@in.nox.app`, "in.nox.app")).toBe(T);
    expect(tokenFrom(`${T}@evil.com`, "in.nox.app")).toBeNull();
    expect(tokenFrom(`short@in.nox.app`, "in.nox.app")).toBeNull();
    expect(tokenFrom(`${T}x@in.nox.app`, "in.nox.app")).toBeNull();
  });
});

describe("bareAddress", () => {
  test("from a display name or plain", () => {
    expect(bareAddress('"Sam S" <Sam@Example.com>')).toBe("sam@example.com");
    expect(bareAddress("sam@example.com")).toBe("sam@example.com");
    expect(bareAddress("nobody")).toBeNull();
  });
});

describe("cleanSubject / cleanBody", () => {
  test("drops forward and reply prefixes", () => {
    expect(cleanSubject("Fwd: RE: fw:  Book the venue ")).toBe("Book the venue");
  });
  test("cuts signatures and quoted replies", () => {
    expect(cleanBody("Call them by Friday.\n\n> old stuff\nOn Mon, Sam wrote:\n> more\n-- \nSent from phone")).toBe("Call them by Friday.");
    expect(cleanBody("---------- Forwarded message ---------\nThe details\n--\nsig")).toBe("The details");
  });
});

describe("emailToItem", () => {
  test("a task named by the subject, with the body as notes", () => {
    expect(emailToItem("Fwd: Renew passport", "Form is online.\n-- \nme")).toEqual({ kind: "task", title: "Renew passport", notes: "Form is online." });
  });
  test("no subject: the first line names it", () => {
    expect(emailToItem("", "Call the bank\nabout the card")).toEqual({ kind: "task", title: "Call the bank", notes: "about the card" });
  });
  test("just a link becomes a link (with the subject as its title)", () => {
    expect(emailToItem("", "https://example.com/post")).toEqual({ kind: "link", url: "https://example.com/post", title: null });
    expect(emailToItem("Read later", "  https://example.com/a  ")).toEqual({ kind: "link", url: "https://example.com/a", title: "Read later" });
    expect(emailToItem("https://example.com/b", "")).toEqual({ kind: "link", url: "https://example.com/b", title: null });
  });
  test("a link inside a longer email stays a task", () => {
    expect(emailToItem("Look at this", "See https://x.com when you can")).toMatchObject({ kind: "task", title: "Look at this" });
  });
  test("nothing to go on: nothing", () => {
    expect(emailToItem("", "\n\n")).toBeNull();
  });
  test("long text is cut to size", () => {
    const item = emailToItem("x".repeat(500), "y".repeat(5000));
    expect(item).toMatchObject({ kind: "task" });
    if (item?.kind === "task") {
      expect(item.title).toHaveLength(200);
      expect(item.notes).toHaveLength(2000);
    }
  });
});
