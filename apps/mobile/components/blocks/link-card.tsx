import { useThemeColors } from "@nox/features";
import type { ContentBlock } from "@nox/types";
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
  const domain = block.domain ?? block.url;
  const color = hashColor(domain);
  return (
    <Pressable
      onPress={() => void openExternal(block.url)}
      onLongPress={onRemove}
      className="border-line bg-surface rounded-card flex-row items-center gap-3 border p-3"
    >
      <View className="h-9 w-9 items-center justify-center rounded-[9px]" style={{ backgroundColor: `${color}29` }}>
        <Text style={{ color }} className="text-[13px] font-bold">{domain.charAt(0).toUpperCase()}</Text>
      </View>
      <View className="flex-1">
        <Text numberOfLines={2} className="text-ink text-[13.5px] font-semibold">{block.title ?? block.url}</Text>
        <Text numberOfLines={1} className="text-ink-3 mt-0.5 text-[10px]">{domain}</Text>
      </View>
    </Pressable>
  );
}
