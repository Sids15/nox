import { AiError, AiRepository } from "@nox/api";
import { usePrefs, useSessionStore } from "@nox/features";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AiCall<A extends unknown[], T> {
  /** Starts the request; resolves to the result, or null when it failed (see `error`). */
  run: (...args: A) => Promise<T | null>;
  busy: boolean;
  error: string | null;
  result: T | null;
  reset: () => void;
}

/**
 * One AI request with its loading and error state. A newer call supersedes an older one still in
 * flight, and nothing lands after the screen has gone — so a slow answer never overwrites a fresh one.
 */
export function useAiCall<A extends unknown[], T>(fn: (...args: A) => Promise<T>): AiCall<A, T> {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const seq = useRef(0);
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A) => {
    const id = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const out = await fnRef.current(...args);
      if (!alive.current || id !== seq.current) return null;
      setResult(out);
      return out;
    } catch (e) {
      // Switched off on another device: hide the AI buttons here too.
      if (e instanceof AiError && e.code === "ai_disabled") usePrefs.getState().setAiEnabled(false);
      if (alive.current && id === seq.current) {
        setError(e instanceof AiError ? e.message : "The AI couldn't answer. Try again.");
      }
      return null;
    } finally {
      if (alive.current && id === seq.current) setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    seq.current++;
    setBusy(false);
    setError(null);
    setResult(null);
  }, []);

  return { run, busy, error, result, reset };
}

/** Whether AI features show at all (Settings → Nox AI). */
export const useAiEnabled = () => usePrefs((s) => s.aiEnabled);

/**
 * Turn Nox AI on or off for the whole account. The device follows at once; the account setting is
 * what the server enforces, so if saving it fails the switch goes back and the error is returned.
 */
export async function setNoxAi(enabled: boolean): Promise<string | null> {
  const prefs = usePrefs.getState();
  const before = prefs.aiEnabled;
  prefs.setAiEnabled(enabled);
  try {
    await AiRepository.setAccountEnabled(enabled);
    return null;
  } catch (e) {
    // Database without migration 0010: there's no account setting yet, so this device's is it.
    const code = (e as { code?: string } | null)?.code;
    if (code === "PGRST204" || code === "42703") return null;
    usePrefs.getState().setAiEnabled(before);
    return "Couldn't save that to your account. Check your connection and try again.";
  }
}

/** On sign-in, take the account's Nox AI setting, so a switch flipped on one device holds on all. */
export function useAiAccountSync() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void AiRepository.accountEnabled().then((on) => {
      if (live && on !== null) usePrefs.getState().setAiEnabled(on);
    });
    return () => {
      live = false;
    };
  }, [userId]);
}
