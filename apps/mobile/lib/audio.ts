import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useEffect, useRef, useState } from "react";

export interface Recording {
  uri: string;
  durationMs: number;
  /** Content type to upload with. Must be in the `audio` bucket's allowed_mime_types. */
  mimeType: string;
  /** File extension for the storage object, matching `mimeType`. */
  ext: string;
}

/** expo-audio's HIGH_QUALITY preset records AAC in an MP4 container. */
const NATIVE_MIME = "audio/m4a";
const NATIVE_EXT = "m4a";

/** Inline voice recorder. `start` requests mic permission and begins; `stop` returns the local
 *  `.m4a` file + duration (null if nothing was captured). */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

  // If the editor unmounts mid-recording (e.g. navigating back without pressing Stop), stop the
  // recorder so the mic session doesn't linger. Track state/recorder via refs and read the
  // JS-tracked `state.isRecording` (never the native `recorder.isRecording` getter) — by the time
  // this cleanup runs on unmount, expo-audio may already have released the native shared object,
  // and touching it throws NativeSharedObjectNotFoundException.
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const isRecordingRef = useRef(false);
  isRecordingRef.current = state.isRecording;
  useEffect(() => {
    return () => {
      if (!isRecordingRef.current) return;
      try {
        recorderRef.current.stop().catch(() => {});
      } catch {
        // native recorder already released during unmount — nothing to stop
      }
    };
  }, []);

  const start = async (): Promise<boolean> => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  };

  const stop = async (): Promise<Recording | null> => {
    const durationMs = Math.round(state.durationMillis ?? 0);
    await recorder.stop();
    return recorder.uri ? { uri: recorder.uri, durationMs, mimeType: NATIVE_MIME, ext: NATIVE_EXT } : null;
  };

  return { isRecording: state.isRecording, durationMs: state.durationMillis ?? 0, start, stop };
}

export interface Playback {
  isPlaying: boolean;
  ready: boolean;
  failed: boolean;
  positionMs: number;
  durationMs: number;
  toggle: () => void;
  seek: (fraction: number) => void;
  skip: (ms: number) => void;
  rate: number;
  setRate: (r: number) => void;
}

/** Play/pause a voice note from a local file or signed URL, with position for a progress bar. */
export function useAudioPlayback(source: string | null, durationHintMs = 0): Playback {
  const player = useAudioPlayer(source ? { uri: source } : null);
  const status = useAudioPlayerStatus(player);
  const [rate, setRateState] = useState(1);
  const total = status.duration > 0 ? status.duration * 1000 : durationHintMs;

  const toggle = () => {
    if (!source) return;
    try {
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) void player.seekTo(0);
        player.play();
      }
    } catch {
      // player released (unmounting) — nothing to do
    }
  };
  const seek = (fraction: number) => {
    if (!total) return;
    void player.seekTo((Math.min(1, Math.max(0, fraction)) * total) / 1000);
  };

  const skip = (ms: number) => {
    const t = Math.max(0, (status.currentTime ?? 0) + ms / 1000);
    void player.seekTo(total ? Math.min(t, total / 1000) : t);
  };
  const setRate = (r: number) => {
    setRateState(r);
    try {
      player.setPlaybackRate(r, "high");
    } catch {
      // released
    }
  };

  return {
    skip,
    rate,
    setRate,
    isPlaying: status.playing,
    ready: status.isLoaded,
    failed: false,
    positionMs: (status.currentTime ?? 0) * 1000,
    durationMs: total,
    toggle,
    seek,
  };
}
