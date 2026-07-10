import { invoke } from "@tauri-apps/api/core";
import { createChunkedStore, type RawStore } from "./chunked-store";
import { isTauri } from "./tauri";

/**
 * Windows Credential Manager caps a credential blob at 2560 bytes, and the keyring crate writes the
 * password as UTF-16 — so the usable ceiling is ~1280 characters, not 2560. 1000 leaves headroom.
 */
const KEYRING_CHUNK = 1000;

/** Raw keystore over the Rust `secret_*` commands. Reads degrade to null; writes warn rather than throw. */
const keyringRaw: RawStore = {
  async getItem(key) {
    try {
      return await invoke<string | null>("secret_get", { key });
    } catch (e) {
      console.warn("[secure-store] keyring read failed:", e);
      return null;
    }
  },
  async setItem(key, value) {
    try {
      await invoke("secret_set", { key, value });
    } catch (e) {
      console.warn("[secure-store] keyring write failed:", e);
    }
  },
  async removeItem(key) {
    try {
      await invoke("secret_delete", { key });
    } catch (e) {
      console.warn("[secure-store] keyring delete failed:", e);
    }
  },
};

/** Plain browser fallback: no OS keystore exists, so localStorage — unchunked, no size limit. */
const browserStore: RawStore = {
  async getItem(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* storage unavailable (private mode / quota) — session just won't persist */
    }
  },
  async removeItem(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

const keyringStore = createChunkedStore(keyringRaw, KEYRING_CHUNK);

/**
 * Desktop session storage. Earlier builds of the Tauri shell kept the session in localStorage, which
 * on Windows is a plaintext LevelDB file under %LOCALAPPDATA% — a long-lived refresh token readable by
 * anything that can read the user's files. Move it into the OS keystore on first read rather than
 * silently signing the user out, then delete the plaintext copy.
 */
const desktopStore: RawStore = {
  async getItem(key) {
    const fromKeyring = await keyringStore.getItem(key);
    if (fromKeyring !== null) return fromKeyring;

    const legacy = await browserStore.getItem(key);
    if (legacy === null) return null;
    await keyringStore.setItem(key, legacy);
    await browserStore.removeItem(key);
    return legacy;
  },
  setItem: (key, value) => keyringStore.setItem(key, value),
  async removeItem(key) {
    // Clear both: a migration that failed halfway must not leave a readable token on disk.
    await keyringStore.removeItem(key);
    await browserStore.removeItem(key);
  },
};

/**
 * Session storage for the web target. In the Tauri shell that's the OS keystore (Windows Credential
 * Manager); in a plain browser tab there is no keystore, so localStorage stands — the accepted
 * tradeoff rules.md's keystore rule scopes to platforms that have one. Chosen per call, not at module
 * load, so nothing depends on Tauri having injected itself before this module is evaluated.
 */
export const secureStoreAdapter: RawStore = {
  getItem: (key) => (isTauri() ? desktopStore : browserStore).getItem(key),
  setItem: (key, value) => (isTauri() ? desktopStore : browserStore).setItem(key, value),
  removeItem: (key) => (isTauri() ? desktopStore : browserStore).removeItem(key),
};
