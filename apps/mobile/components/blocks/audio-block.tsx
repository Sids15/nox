import { useThemeColors } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { Play } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

type AudioB = Extract<ContentBlock, { type: "audio" }>;

const fmtDur = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const BARS = [8, 14, 19, 11, 16, 9, 13, 17, 10, 15];

/** A voice-note block. Stage A is a static player card; Stage C wires real record/playback. */
export function AudioBlock({ block, onRemove }: { block: AudioB; onRemove: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onLongPress={onRemove}
      className="border-line bg-surface rounded-card flex-row items-center gap-3 border p-[13px]"
    >
      <View className="bg-accent h-[38px] w-[38px] items-center justify-center rounded-full">
        <Play size={13} color={c.onAccent} fill={c.onAccent} />
      </View>
      <View className="flex-1 flex-row items-end gap-[3px]" style={{ height: 20 }}>
        {BARS.map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: c.ink3 }} />
        ))}
      </View>
      <Text className="text-ink-2 font-mono text-[11px]">{fmtDur(block.durationMs)}</Text>
    </Pressable>
  );
}
