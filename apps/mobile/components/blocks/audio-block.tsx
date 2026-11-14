import { useThemeColors } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import { confirmDelete } from "../../lib/confirm";
import { useAudioPlayback } from "../../lib/audio";
import { useSignedUrl } from "../../lib/storage";
import { pressScale } from "../menu";

type AudioB = Extract<ContentBlock, { type: "audio" }>;

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const RATES = [1, 1.5, 2, 0.75];
const TABULAR = { fontVariant: ["tabular-nums" as const] };

/**
 * A voice note, played like Voice Memos: play / pause, a scrubber you can tap or drag, elapsed and
 * remaining time, skip back / forward 15 s, and playback speed. Shows "Saving…" until the upload
 * finishes and says so plainly if the browser can't play the file.
 */
export function AudioBlock({ block, onRemove }: { block: AudioB; onRemove: () => void }) {
  const c = useThemeColors();
  const { data: signed } = useSignedUrl("audio", block.localUri ? null : block.storagePath);
  const source = block.localUri ?? signed ?? null;
  const p = useAudioPlayback(source, block.durationMs);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);

  const total = p.durationMs || block.durationMs;
  const progress = drag ?? (total ? Math.min(1, p.positionMs / total) : 0);
  const shownPos = drag !== null ? drag * total : p.positionMs;
  const saving = !block.storagePath;

  const frac = (e: GestureResponderEvent) => (width ? Math.min(1, Math.max(0, e.nativeEvent.locationX / width)) : 0);
  const remove = () =>
    confirmDelete({ title: "Delete voice note?", message: "This recording will be removed from the page.", onConfirm: onRemove });

  return (
    <View className="border-line bg-surface rounded-[14px] border px-4 pb-3 pt-3" style={{ maxWidth: 460, width: "100%", alignSelf: "flex-start" }}>
      <View className="flex-row items-center">
        <Text className="text-ink flex-1 text-[14px] font-semibold">Voice note</Text>
        {saving && <Text className="text-ink-3 mr-2 text-[12px]">Saving…</Text>}
        <Pressable
          onPress={remove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete voice note"
          className="hover:bg-chip -mr-1.5 h-7 w-7 items-center justify-center rounded-[8px]"
        >
          <X size={14} color={c.ink3} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Scrubber: tap anywhere or drag. */}
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !!total && !p.failed}
        onMoveShouldSetResponder={() => !!total && !p.failed}
        onResponderGrant={(e) => setDrag(frac(e))}
        onResponderMove={(e) => setDrag(frac(e))}
        onResponderRelease={(e) => {
          p.seek(frac(e));
          setDrag(null);
        }}
        onResponderTerminate={() => setDrag(null)}
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityValue={{ min: 0, max: Math.round(total / 1000), now: Math.round(shownPos / 1000) }}
        className="mt-3 h-5 justify-center"
        style={{ cursor: "pointer" } as object}
      >
        <View className="bg-line h-[4px] rounded-full" pointerEvents="none">
          <View className="bg-accent h-[4px] rounded-full" style={{ width: `${progress * 100}%` }} />
        </View>
        <View
          pointerEvents="none"
          className="bg-accent absolute h-3.5 w-3.5 rounded-full"
          style={{ left: Math.max(0, progress * width - 7), borderWidth: 2, borderColor: c.surface }}
        />
      </View>
      <View className="flex-row justify-between">
        <Text style={TABULAR} className="text-ink-3 text-[11.5px]">
          {fmt(shownPos)}
        </Text>
        <Text style={TABULAR} className="text-ink-3 text-[11.5px]">
          −{fmt(total - shownPos)}
        </Text>
      </View>

      {p.failed ? (
        <Text className="text-ink-2 mt-2 text-[13px]">
          This recording can't be played here. It may be in a format this browser doesn't support; try it on another device.
        </Text>
      ) : (
        <View className="mt-1 flex-row items-center justify-between">
          <Pressable
            onPress={() => p.setRate(RATES[(RATES.indexOf(p.rate) + 1) % RATES.length]!)}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${p.rate}×`}
            className="hover:bg-chip h-8 min-w-[44px] items-center justify-center rounded-[8px] px-2"
          >
            <Text style={TABULAR} className="text-ink-2 text-[13px] font-semibold">
              {p.rate}×
            </Text>
          </Pressable>
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => p.skip(-15000)}
              disabled={!source}
              accessibilityRole="button"
              accessibilityLabel="Back 15 seconds"
              className="hover:bg-chip h-9 w-9 items-center justify-center rounded-full"
            >
              <RotateCcw size={20} color={c.ink2} strokeWidth={1.8} />
              <Text className="text-ink-2 absolute text-[7px] font-bold" style={{ top: 14 }}>
                15
              </Text>
            </Pressable>
            <Pressable
              onPress={p.toggle}
              disabled={!source}
              accessibilityRole="button"
              accessibilityLabel={p.isPlaying ? "Pause" : "Play"}
              style={pressScale}
              className="bg-accent h-11 w-11 items-center justify-center rounded-full"
            >
              {p.isPlaying ? (
                <Pause size={17} color={c.onAccent} fill={c.onAccent} />
              ) : (
                <Play size={17} color={c.onAccent} fill={c.onAccent} style={{ marginLeft: 2, opacity: source ? 1 : 0.5 }} />
              )}
            </Pressable>
            <Pressable
              onPress={() => p.skip(15000)}
              disabled={!source}
              accessibilityRole="button"
              accessibilityLabel="Forward 15 seconds"
              className="hover:bg-chip h-9 w-9 items-center justify-center rounded-full"
            >
              <RotateCw size={20} color={c.ink2} strokeWidth={1.8} />
              <Text className="text-ink-2 absolute text-[7px] font-bold" style={{ top: 14 }}>
                15
              </Text>
            </Pressable>
          </View>
          <View className="min-w-[44px]" />
        </View>
      )}
    </View>
  );
}
