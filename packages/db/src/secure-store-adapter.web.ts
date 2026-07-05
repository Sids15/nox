/**
 * Web session storage. There is no OS keystore in the browser, so we back the Supabase session with
 * `localStorage` (the standard for supabase-js on web) — no chunking needed. rules.md's "tokens in
 * the encrypted keystore" rule is a native-platform concern; on web this is the accepted tradeoff so
 * the session survives a refresh. Same interface as the native chunked adapter.
 */
export const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* storage unavailable (private mode / quota) — session just won't persist */
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
