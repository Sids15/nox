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

  // A compact card sized to its content (a voice memo isn't a full-width banner), labelled so it
  // reads as a recording at a glance.
  return (
    <Pressable
      onLongPress={onRemove}
      className="border-line bg-surface flex-row items-center gap-3 rounded-[14px] border py-2.5 pl-2.5 pr-4"
      style={{ maxWidth: 380, alignSelf: "flex-start", width: "100%" }}
    >
      <Pressable
        onPress={toggle}
        disabled={!source}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause voice memo" : "Play voice memo"}
        className="bg-accent h-[36px] w-[36px] items-center justify-center rounded-full"
        style={{ opacity: source ? 1 : 0.5 }}
      >
        {isPlaying ? (
          <Pause size={13} color={c.onAccent} fill={c.onAccent} />
        ) : (
          <Play size={13} color={c.onAccent} fill={c.onAccent} style={{ marginLeft: 2 }} />
        )}
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-ink text-[13.5px] font-semibold">Voice memo</Text>
        <View className="mt-1 flex-row items-end gap-[3px]" style={{ height: 14 }}>
          {BARS.map((h, i) => (
            <View
              key={i}
              style={{ width: 2.5, height: Math.max(3, h * 0.7), borderRadius: 2, backgroundColor: isPlaying ? c.accent : c.ink3, opacity: isPlaying ? 1 : 0.6 }}
            />
          ))}
        </View>
      </View>
      <Text style={{ fontVariant: ["tabular-nums"] }} className="text-ink-2 text-[12.5px] font-medium">
        {fmtDur(block.durationMs)}
      </Text>
    </Pressable>
  );
}
