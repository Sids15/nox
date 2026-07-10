import * as SecureStore from "expo-secure-store";
import { createChunkedStore } from "./chunked-store";

/**
 * Auth-token storage backed entirely by the OS-encrypted keystore (expo-secure-store).
 * SecureStore rejects values larger than ~2KB and Supabase sessions can exceed that, so the shared
 * chunked store splits them transparently. Tokens never touch plaintext/AsyncStorage (rules.md).
 */
const SECURE_STORE_CHUNK = 2000;

export const secureStoreAdapter = createChunkedStore(
  {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  },
  SECURE_STORE_CHUNK,
);
