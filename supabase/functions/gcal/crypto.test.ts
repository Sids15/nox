import { describe, expect, test } from "bun:test";
import { importKey, open, pkce, safeReturn, seal } from "./crypto";

const KEY = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i)));

describe("token sealing", () => {
  test("round-trips, and each seal is different", async () => {
    const key = await importKey(KEY);
    const a = await seal(key, "1//refresh-token");
    const b = await seal(key, "1//refresh-token");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1.")).toBe(true);
    expect(await open(key, a)).toBe("1//refresh-token");
  });
  test("tampering or the wrong key fails", async () => {
    const key = await importKey(KEY);
    const sealed = await seal(key, "secret");
    const [v, iv, ct] = sealed.split(".");
    const flipped = `${v}.${iv}.${ct!.slice(0, -4)}AAAA`;
    let failed = false;
    try {
      await open(key, flipped);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    const other = await importKey(btoa(String.fromCharCode(...new Uint8Array(32).fill(7))));
    failed = false;
    try {
      await open(other, sealed);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
  test("a key must be 32 bytes", async () => {
    let failed = false;
    try {
      await importKey(btoa("short"));
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});

describe("pkce", () => {
  test("a base64url verifier and its S256 challenge", async () => {
    const { verifier, challenge } = await pkce();
    expect(/^[A-Za-z0-9_-]{43}$/.test(verifier)).toBe(true);
    expect(/^[A-Za-z0-9_-]{43}$/.test(challenge)).toBe(true);
    expect(verifier).not.toBe(challenge);
  });
});

describe("safeReturn", () => {
  const allowed = ["https://nox.app", "nox://"];
  test("only back to Nox", () => {
    expect(safeReturn("https://nox.app/settings?gcal=1", allowed, "x")).toBe("https://nox.app/settings?gcal=1");
    expect(safeReturn("nox://settings", allowed, "x")).toBe("nox://settings");
    expect(safeReturn("https://nox.app.evil.com/x", allowed, "x")).toBe("x");
    expect(safeReturn("https://evil.com/?https://nox.app", allowed, "x")).toBe("x");
    expect(safeReturn(42, allowed, "x")).toBe("x");
  });
});
