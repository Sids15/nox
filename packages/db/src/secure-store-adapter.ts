import * as SecureStore from "expo-secure-store";

/**
 * Auth-token storage backed entirely by the OS-encrypted keystore (expo-secure-store).
 * SecureStore rejects values larger than ~2KB, and Supabase sessions can exceed that, so we
 * transparently split values into chunks. Tokens never touch plaintext/AsyncStorage (rules.md).
 */
const CHUNK_SIZE = 2000;
const countKey = (key: string) => `${key}.__chunks`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

async function clearChunks(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(countKey(key));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
  const deletions: Promise<void>[] = [SecureStore.deleteItemAsync(countKey(key))];
  for (let i = 0; i < count; i++) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  }
  await Promise.all(deletions);
}

export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(countKey(key));
    if (!countRaw) return null;
    const count = Number.parseInt(countRaw, 10);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null; // corrupt/partial — treat as absent
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(key: string, value: string): Promise<void> {
    await clearChunks(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((part, i) => SecureStore.setItemAsync(chunkKey(key, i), part)),
    );
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await clearChunks(key);
  },
};
