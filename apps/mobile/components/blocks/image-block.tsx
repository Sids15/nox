import type { ContentBlock } from "@nox/types";
import { useThemeColors } from "@nox/features";
import { X } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";
import { confirmDelete } from "../../lib/confirm";
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

  const remove = () => confirmDelete({ title: "Remove picture?", message: "It will be removed from the page.", confirmLabel: "Remove", onConfirm: onRemove });
  return (
    <Pressable
      onLongPress={remove}
      className="border-line bg-chip overflow-hidden rounded-[14px] border"
      style={{ aspectRatio: uri ? ratio : undefined }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <View className="h-[150px] items-center justify-center">
          <Text className="text-ink-3 text-[12px]">Loading picture…</Text>
        </View>
      )}
      <Pressable
        onPress={remove}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Remove picture"
        className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-black/55"
      >
        <X size={14} color="#fff" strokeWidth={2.4} />
      </Pressable>
      {!block.storagePath && (
        <View className="absolute bottom-2 left-2 rounded-[7px] bg-black/55 px-2 py-0.5">
          <Text className="text-[11.5px] font-medium text-white">Saving…</Text>
        </View>
      )}
    </Pressable>
  );
}
