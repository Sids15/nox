/** A plain async key/value store. Both OS keystores we target expose exactly this. */
export interface RawStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Wraps a size-limited key/value store so it can hold values of any length, by splitting them across
 * numbered entries plus a `.__chunks` count. Every OS keystore we use caps a single value:
 * expo-secure-store rejects roughly >2KB, and Windows Credential Manager caps the blob at 2560 bytes
 * — which the keyring crate fills with UTF-16, so the real ceiling there is ~1280 characters. Hence
 * `chunkSize` is per-platform rather than a shared constant.
 *
 * A partially written value (some chunk missing) reads back as `null` rather than a truncated
 * session: a corrupt session is worse than no session, because supabase-js would treat the garbage
 * as a real token and fail authenticated requests instead of prompting a sign-in.
 */
export function createChunkedStore(raw: RawStore, chunkSize: number): RawStore {
  const countKey = (key: string) => `${key}.__chunks`;
  const chunkKey = (key: string, i: number) => `${key}.${i}`;

  async function clearChunks(key: string): Promise<void> {
    const countRaw = await raw.getItem(countKey(key));
    const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
    const deletions: Promise<void>[] = [raw.removeItem(countKey(key))];
    for (let i = 0; i < count; i++) deletions.push(raw.removeItem(chunkKey(key, i)));
    await Promise.all(deletions);
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const countRaw = await raw.getItem(countKey(key));
      if (!countRaw) return null;
      const count = Number.parseInt(countRaw, 10);
      // A count that isn't a whole number is corruption. Without this, NaN skips the loop and the
      // join below returns "" — a present-but-empty session that supabase-js then fails to parse.
      if (!Number.isInteger(count) || count < 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await raw.getItem(chunkKey(key, i));
        if (part === null) return null; // corrupt/partial — treat as absent
        parts.push(part);
      }
      return parts.join("");
    },

    async setItem(key: string, value: string): Promise<void> {
      await clearChunks(key);
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += chunkSize) chunks.push(value.slice(i, i + chunkSize));
      await Promise.all(chunks.map((part, i) => raw.setItem(chunkKey(key, i), part)));
      // Written last: the count is what makes the value readable, so a crash mid-write leaves the
      // key absent rather than half-present.
      await raw.setItem(countKey(key), String(chunks.length));
    },

    async removeItem(key: string): Promise<void> {
      await clearChunks(key);
    },
  };
}
