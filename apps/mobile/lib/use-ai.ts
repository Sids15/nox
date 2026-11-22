import { AiError } from "@nox/api";
import { usePrefs } from "@nox/features";
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
