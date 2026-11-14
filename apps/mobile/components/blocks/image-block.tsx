import type { ContentBlock } from "@nox/types";
import { Image, Pressable, Text, View } from "react-native";
import { useSignedUrl } from "../../lib/storage";

type ImgBlock = Extract<ContentBlock, { type: "image" }>;

/**
 * An image block. Shows the local file immediately after capture, then (for images synced from
 * another device, or after the local file is gone) a signed URL from `storagePath`. Long-press
 * removes.
 */
export function ImageBlock({ block, onRemove }: { block: ImgBlock; onRemove: () => void }) {
  const { data: signed } = useSignedUrl("images", block.localUri ? null : block.storagePath);
  const uri = block.localUri ?? signed ?? undefined;
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
          <Text className="text-ink-3 text-[10px]">image</Text>
        </View>
      )}
    </Pressable>
  );
}
