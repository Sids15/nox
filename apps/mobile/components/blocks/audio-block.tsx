import { useThemeColors } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { Pause, Play } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useAudioPlayback } from "../../lib/audio";
import { useSignedUrl } from "../../lib/storage";

type AudioB = Extract<ContentBlock, { type: "audio" }>;

const fmtDur = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const BARS = [8, 14, 19, 11, 16, 9, 13, 17, 10, 15];

/** A voice-note block: play/pause from the local file or a signed URL, with duration. */
export function AudioBlock({ block, onRemove }: { block: AudioB; onRemove: () => void }) {
  const c = useThemeColors();
  const { data: signed } = useSignedUrl("audio", block.localUri ? null : block.storagePath);
  const source = block.localUri ?? signed ?? null;
  const { isPlaying, toggle } = useAudioPlayback(source);

  return (
    <Pressable
      onLongPress={onRemove}
      className="border-line bg-surface rounded-card flex-row items-center gap-3 border p-[13px]"
    >
      <Pressable
        onPress={toggle}
        disabled={!source}
        className="bg-accent h-[38px] w-[38px] items-center justify-center rounded-full"
      >
        {isPlaying ? (
          <Pause size={13} color={c.onAccent} fill={c.onAccent} />
        ) : (
          <Play size={13} color={c.onAccent} fill={c.onAccent} />
        )}
      </Pressable>
      <View className="flex-1 flex-row items-end gap-[3px]" style={{ height: 20 }}>
        {BARS.map((h, i) => (
          <View
            key={i}
            style={{ width: 3, height: h, borderRadius: 2, backgroundColor: isPlaying ? c.accent : c.ink3 }}
          />
        ))}
      </View>
      <Text className="text-ink-2 text-[11px]">{fmtDur(block.durationMs)}</Text>
    </Pressable>
  );
}
