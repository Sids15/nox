import { describe, expect, test } from "bun:test";
import { createChunkedStore, type RawStore } from "./chunked-store";

/** In-memory stand-in for an OS keystore, with the backing map exposed so tests can corrupt it. */
function memoryStore(): RawStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async getItem(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

describe("createChunkedStore", () => {
  test("round-trips a value shorter than one chunk", async () => {
    const raw = memoryStore();
    const store = createChunkedStore(raw, 10);
    await store.setItem("k", "short");
    expect(await store.getItem("k")).toBe("short");
  });

  test("splits a long value across chunks and rejoins it in order", async () => {
    const raw = memoryStore();
    const store = createChunkedStore(raw, 4);
    const value = "abcdefghijk"; // 11 chars -> 3 chunks of 4/4/3
    await store.setItem("k", value);

    expect(raw.map.get("k.__chunks")).toBe("3");
    expect(raw.map.get("k.0")).toBe("abcd");
    expect(raw.map.get("k.1")).toBe("efgh");
    expect(raw.map.get("k.2")).toBe("ijk");
    expect(await store.getItem("k")).toBe(value);
  });

  test("a missing key reads as null", async () => {
    const store = createChunkedStore(memoryStore(), 4);
    expect(await store.getItem("absent")).toBeNull();
  });

  test("a partially written value reads as null, never a truncated string", async () => {
    const raw = memoryStore();
    const store = createChunkedStore(raw, 4);
    await store.setItem("k", "abcdefgh");
    raw.map.delete("k.1"); // simulate a lost chunk

    // Returning "abcd" here would hand supabase-js a corrupt session it would treat as a real token.
    expect(await store.getItem("k")).toBeNull();
  });

  test("overwriting a long value leaves no orphan chunks behind", async () => {
    const raw = memoryStore();
    const store = createChunkedStore(raw, 4);
    await store.setItem("k", "abcdefghijk"); // 3 chunks
    await store.setItem("k", "xy"); // 1 chunk

    expect(await store.getItem("k")).toBe("xy");
    expect(raw.map.has("k.1")).toBe(false);
    expect(raw.map.has("k.2")).toBe(false);
  });

  test("removeItem clears every chunk and the count", async () => {
    const raw = memoryStore();
    const store = createChunkedStore(raw, 4);
    await store.setItem("k", "abcdefghijk");
    await store.removeItem("k");

    expect(await store.getItem("k")).toBeNull();
    expect(raw.map.size).toBe(0);
  });

  test("reads a corrupt chunk count as absent, not as an empty value", async () => {
    const raw = memoryStore();
    const store = createChunkedStore(raw, 4);
    await store.setItem("k", "abcdefgh");
    raw.map.set("k.__chunks", "garbage");

    expect(await store.getItem("k")).toBeNull();
  });

  test("keys do not collide across values", async () => {
    const raw = memoryStore();
    const store = createChunkedStore(raw, 4);
    await store.setItem("a", "aaaaaaa");
    await store.setItem("b", "bbb");

    expect(await store.getItem("a")).toBe("aaaaaaa");
    expect(await store.getItem("b")).toBe("bbb");
  });
});
