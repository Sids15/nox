import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

export interface Recording {
  uri: string;
  durationMs: number;
}

/** Inline voice recorder. `start` requests mic permission and begins; `stop` returns the local
 *  `.m4a` file + duration (null if nothing was captured). */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);

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
