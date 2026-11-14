import { useEffect, useRef, useState } from "react";
import type { Dictation } from "./dictation";

export type { Dictation } from "./dictation";

// The Web Speech API isn't in TypeScript's DOM lib; describe the part we use.
interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const MESSAGES: Record<string, string> = {
  "not-allowed": "Nox needs microphone access to dictate. Allow it in your browser and try again.",
  "service-not-allowed": "Dictation isn't available in this browser.",
  "no-speech": "Didn't catch anything. Try again a little closer to the mic.",
  network: "Dictation needs an internet connection in this browser.",
  "audio-capture": "No microphone was found.",
};

/**
 * Speech → text with the browser's recogniser (Chrome, Edge, Safari). Final phrases go to `onFinal`
 * as they're recognised; `interim` shows the words still being worked out. Keeps listening until
 * stopped — browsers end a session after a pause, so it restarts itself while active.
 *
 * Note: Chrome and Edge send the audio to their speech service to transcribe it; Safari can do it
 * on device. Nothing is recorded or stored by Nox.
 */
export function useDictation(onFinal: (text: string) => void): Dictation {
  const Ctor = recognitionCtor();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(
    () => () => {
      wanted.current = false;
      rec.current?.abort();
    },
    [],
  );

  const start = () => {
    if (!Ctor || listening) return;
    setError(null);
    const r = new Ctor();
    r.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const text = res[0].transcript;
        if (res.isFinal) {
          const t = text.trim();
          if (t) onFinalRef.current(t);
        } else pending += text;
      }
      setInterim(pending.trim());
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "no-speech" && wanted.current) return; // keep listening through silence
      wanted.current = false;
      setError(MESSAGES[e.error] ?? "Dictation stopped unexpectedly.");
    };
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
          return;
        } catch {
          // fall through and stop
        }
      }
      setListening(false);
      setInterim("");
      rec.current = null;
    };
    rec.current = r;
    wanted.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      wanted.current = false;
      setError("Dictation couldn't start.");
    }
  };

  const stop = () => {
    wanted.current = false;
    rec.current?.stop();
  };

  return { supported: !!Ctor, listening, interim, error, start, stop };
}
