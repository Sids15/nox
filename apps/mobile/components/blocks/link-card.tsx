import { useThemeColors } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { ExternalLink, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { openExternal } from "../../lib/open-external";
import { TAG_PALETTE } from "../../lib/tag-palette";

type LinkBlock = Extract<ContentBlock, { type: "link" }>;

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

/** An embedded link card. Tap opens the URL; long-press removes the block. */
export function LinkCard({ block, onRemove }: { block: LinkBlock; onRemove: () => void }) {
  const c = useThemeColors();
  const domain = block.domain ?? block.url;
  const color = hashColor(domain);
  return (
    <Pressable
      onPress={() => void openExternal(block.url)}
      onLongPress={onRemove}
      accessibilityRole="link"
      className="border-line bg-surface hover:border-accent/[0.4] flex-row items-center gap-3 rounded-[14px] border py-2.5 pl-3 pr-2"
    >
      <View className="h-9 w-9 items-center justify-center rounded-[9px]" style={{ backgroundColor: `${color}29` }}>
        <Text style={{ color }} className="text-[13px] font-bold">{domain.charAt(0).toUpperCase()}</Text>
      </View>
      <View className="flex-1">
        <Text numberOfLines={2} className="text-ink text-[14px] font-semibold">{block.title ?? block.url}</Text>
        <View className="mt-0.5 flex-row items-center gap-1">
          <Text numberOfLines={1} className="text-ink-3 text-[12px]">{domain}</Text>
          <ExternalLink size={11} color={c.ink3} strokeWidth={2} />
        </View>
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          onRemove();
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Remove link"
        className="hover:bg-chip h-7 w-7 items-center justify-center rounded-[8px]"
      >
        <X size={14} color={c.ink3} strokeWidth={2.2} />
      </Pressable>
    </Pressable>
  );
}
