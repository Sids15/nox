import { useThemeVars } from "@nox/features";
import { vars } from "nativewind";
import { Modal, Pressable, Text, View } from "react-native";

/**
 * Inline player for a TRUSTED video source (classifySource → embedUrl). The embed is an `<iframe>`
 * pointing only at youtube-nocookie / player.vimeo — hosts the desktop CSP's `frame-src` explicitly
 * allows; every other URL is refused upstream, so this never embeds an arbitrary page. Rendered over
 * a dimmed backdrop, 16:9, capped so it never fills a desktop window edge-to-edge.
 */
export function VideoPlayer({
  embedUrl,
  title,
  onClose,
}: {
  embedUrl: string | null;
  title?: string;
  onClose: () => void;
}) {
  const themeVars = useThemeVars();
  if (!embedUrl) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/80 px-6">
        <Pressable onPress={() => {}} className="w-full max-w-[900px]">
          <View className="mb-2 flex-row items-center justify-between">
            <Text numberOfLines={1} className="text-ink flex-1 pr-3 text-[14px] font-semibold">
              {title ?? "Video"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} className="bg-chip rounded-pill px-3 py-1.5">
              <Text className="text-ink-2 text-[13px] font-semibold">Close</Text>
            </Pressable>
          </View>
          <View className="bg-elev overflow-hidden rounded-[14px]" style={{ aspectRatio: 16 / 9 }}>
            <iframe
              src={`${embedUrl}?autoplay=1`}
              title={title ?? "Video"}
              style={{ width: "100%", height: "100%", border: "0" }}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
