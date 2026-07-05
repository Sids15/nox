import { useEffect, useRef, useState } from "react";
import type { Recording } from "./audio";

/**
 * Web audio shim. Recording is not wired on web yet (would need MediaRecorder), so `start` returns
 * false and the toolbar mic degrades gracefully. Playback uses a plain HTMLAudioElement so voice
 * notes captured on a phone still play back in the browser via their signed URL.
 */
export function useVoiceRecorder() {
  return {
    isRecording: false,
    durationMs: 0,
    async start(): Promise<boolean> {
      return false;
    },
    async stop(): Promise<Recording | null> {
      return null;
    },
  };
}

export function useAudioPlayback(source: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!source) {
      audioRef.current = null;
      setReady(false);
      return;
    }
    const el = new Audio(source);
    audioRef.current = el;
    const onReady = () => setReady(true);
    const onEnded = () => setIsPlaying(false);
    el.addEventListener("canplay", onReady);
    el.addEventListener("ended", onEnded);
    return () => {
      el.pause();
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("ended", onEnded);
      audioRef.current = null;
      setReady(false);
      setIsPlaying(false);
    };
  }, [source]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  return { isPlaying, toggle, ready };
}
