import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useEffect, useRef } from "react";

export interface Recording {
  uri: string;
  durationMs: number;
}

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
    return recorder.uri ? { uri: recorder.uri, durationMs } : null;
  };

  return { isRecording: state.isRecording, durationMs: state.durationMillis ?? 0, start, stop };
}

/** Play/pause a voice note from a local file or signed URL. */
export function useAudioPlayback(source: string | null) {
  const player = useAudioPlayer(source ? { uri: source } : null);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (!source) return;
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= status.duration) player.seekTo(0);
      player.play();
    }
  };

  return { isPlaying: status.playing, toggle, ready: status.isLoaded };
}
