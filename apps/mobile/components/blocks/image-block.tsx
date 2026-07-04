import { useThemeColors } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { Image, Pressable, Text, View } from "react-native";

type ImgBlock = Extract<ContentBlock, { type: "image" }>;

/**
 * An image block. Stage A shows the local file (if any) or a placeholder; Stage B fills in the
 * signed URL from `storagePath` for images synced from another device. Long-press removes.
 */
export function ImageBlock({ block, onRemove }: { block: ImgBlock; onRemove: () => void }) {
  const c = useThemeColors();
  const uri = block.localUri ?? undefined;
  const ratio = block.width && block.height ? block.width / block.height : 1.6;

  return (
    <Pressable
      onLongPress={onRemove}
      className="border-line bg-chip rounded-card overflow-hidden border"
      style={{ aspectRatio: uri ? ratio : undefined }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <View className="h-[150px] items-center justify-center">
          <Text className="text-ink-3 font-mono text-[10px]">image</Text>
        </View>
      )}
    </Pressable>
  );
}
