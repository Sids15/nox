import { useEffect, useRef, useState } from "react";
import type { Recording } from "./audio";

interface Format {
  /** Passed to MediaRecorder — may carry a `;codecs=` parameter. */
  recorderMime: string;
  /** Bare type used as the upload's Content-Type; Supabase matches allowed_mime_types exactly. */
  contentType: string;
  ext: string;
}

/**
 * Ordered by cross-platform playability, not quality. MP4/AAC plays everywhere including iOS; Opus in
 * WebM plays in Chromium and Firefox but NOT on iOS, so a note recorded on desktop in WebM would be
 * silent on the user's phone. Prefer MP4 wherever the browser can produce it.
 */
const CANDIDATES: Format[] = [
  { recorderMime: "audio/mp4", contentType: "audio/mp4", ext: "m4a" },
  { recorderMime: "audio/mp4;codecs=mp4a.40.2", contentType: "audio/mp4", ext: "m4a" },
  { recorderMime: "audio/webm;codecs=opus", contentType: "audio/webm", ext: "webm" },
  { recorderMime: "audio/webm", contentType: "audio/webm", ext: "webm" },
];

function pickFormat(): Format | null {
  if (typeof MediaRecorder === "undefined") return null;
  return CANDIDATES.find((f) => MediaRecorder.isTypeSupported(f.recorderMime)) ?? null;
}

/**
 * Inline voice recorder for the web target (and the Tauri shell, which is the same bundle).
 *
 * `start` prompts for the mic and returns false if the browser has no MediaRecorder, no supported
 * container, or the user denies permission — the toolbar surfaces that rather than appearing to work.
 * `stop` resolves the recorded blob as an object URL, which `storage.web.ts` uploads by fetching it
 * back into a Blob. We never revoke it: the editor renders the block from that URL until the upload
 * fills in `storagePath`.
 */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const formatRef = useRef<Format | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Release the mic and the timer. Leaving a live track on holds the browser's recording indicator. */
  const teardown = () => {
    if (tickRef.current !== null) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  // If the editor unmounts mid-recording (navigating back without pressing Stop), drop the mic.
  useEffect(() => {
    return () => {
      const mr = recorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
      teardown();
    };
  }, []);

  const start = async (): Promise<boolean> => {
    const format = pickFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) return false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false; // dismissed or blocked
    }

    try {
      const recorder = new MediaRecorder(stream, { mimeType: format.recorderMime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();

      recorderRef.current = recorder;
      streamRef.current = stream;
      formatRef.current = format;
      startedAtRef.current = Date.now();
      setDurationMs(0);
      setIsRecording(true);
      tickRef.current = setInterval(() => setDurationMs(Date.now() - startedAtRef.current), 200);
      return true;
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
  };

  const stop = async (): Promise<Recording | null> => {
    const recorder = recorderRef.current;
    const format = formatRef.current;
    if (!recorder || !format) return null;

    // MediaRecorder has no duration; the elapsed wall clock is the recording's length.
    const elapsed = Date.now() - startedAtRef.current;
    const collect = () => new Blob(chunksRef.current, { type: format.contentType });
    const blob = await new Promise<Blob>((resolve) => {
      // stop() on an already-inactive recorder throws InvalidStateError and `onstop` never fires,
      // which would leave this promise — and the caller's await — pending forever.
      if (recorder.state === "inactive") {
        resolve(collect());
        return;
      }
      recorder.onstop = () => resolve(collect());
      try {
        recorder.stop();
      } catch {
        resolve(collect());
      }
    });

    teardown();
    setIsRecording(false);
    setDurationMs(0);
    if (blob.size === 0) return null;

    return {
      uri: URL.createObjectURL(blob),
      durationMs: elapsed,
      mimeType: format.contentType,
      ext: format.ext,
    };
  };

  return { isRecording, durationMs, start, stop };
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
