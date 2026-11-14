import type { Resource, Tag } from "@nox/types";
import { Play } from "lucide-react-native";
import { Image, type ImageStyle, Pressable, type StyleProp, Text, View } from "react-native";
import { useSignedUrl } from "../../lib/storage";
import { TAG_PALETTE } from "../../lib/tag-palette";

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

/** Renders a thumbnail from either a remote URL (og:image) or a private Storage path (a picked
 *  image), signing the latter on demand. Returns null while a signed URL is still resolving. */
function Thumb({ value, style }: { value: string; style: StyleProp<ImageStyle> }) {
  const isRemote = /^(https?:|file:|data:)/.test(value);
  const { data: signed } = useSignedUrl("images", isRemote ? null : value);
  const uri = isRemote ? value : signed ?? null;
  if (!uri) return null;
  return <Image source={{ uri }} style={style} resizeMode="cover" />;
}

function TagsRow({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-[5px]">
      {tags.map((t) => (
        <View key={t.id} style={{ backgroundColor: `${t.color}1f`, borderRadius: 5 }} className="px-[7px] py-1">
          <Text style={{ color: t.color }} className="font-mono text-[9.5px] font-semibold">
            {t.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A masonry resource card, rendered by type (video / image / link / text). */
export function ResourceCard({
  resource,
  tags,
  onPress,
  onLongPress,
}: {
  resource: Resource;
  tags: Tag[];
  onPress: () => void;
  onLongPress: () => void;
}) {
  const shell = "border-line bg-surface rounded-card hover:border-accent/[0.4] mb-[11px] overflow-hidden border";
  const title = resource.title ?? resource.url ?? "Untitled";

  if (resource.type === "video") {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} className={shell}>
        {/* 16:9 like the video itself — a fixed 88px strip cropped wide desktop cards to a sliver. */}
        <View className="bg-chip relative items-center justify-center" style={{ aspectRatio: 16 / 9 }}>
          {resource.thumbnail_url ? (
            <Thumb value={resource.thumbnail_url} style={{ position: "absolute", inset: 0 }} />
          ) : null}
          <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(10,10,16,0.72)" }}>
            <Play size={11} color="#fff" fill="#fff" />
          </View>
          {resource.duration ? (
            <View className="absolute bottom-[7px] right-[7px] rounded-[5px] px-1.5 py-1" style={{ backgroundColor: "rgba(10,10,16,0.72)" }}>
              <Text className="font-mono text-[9.5px] font-semibold text-white">{resource.duration}</Text>
            </View>
          ) : null}
        </View>
        <View className="gap-[7px] p-3">
          <Text numberOfLines={3} className="text-ink text-[13.5px] font-semibold" style={{ lineHeight: 18 }}>{title}</Text>
          {resource.domain ? <Text className="text-ink-3 font-mono text-[10px]">{resource.domain}</Text> : null}
          <TagsRow tags={tags} />
        </View>
      </Pressable>
    );
  }

  if (resource.type === "image") {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} className={shell}>
        <View className="bg-chip h-[124px] items-center justify-center">
          {resource.thumbnail_url ? (
            <Thumb value={resource.thumbnail_url} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text className="text-ink-3 font-mono text-[9.5px]">image</Text>
          )}
        </View>
        <View className="gap-[7px] p-3">
          <Text numberOfLines={3} className="text-ink text-[13.5px] font-semibold" style={{ lineHeight: 18 }}>{title}</Text>
          <TagsRow tags={tags} />
        </View>
      </Pressable>
    );
  }

  if (resource.type === "text") {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} className={`${shell} p-3`}>
        <View className="gap-2">
          <Text numberOfLines={6} className="text-ink-2 text-[13px]" style={{ fontFamily: "Georgia", lineHeight: 20 }}>
            {resource.body ? `“${resource.body}”` : title}
          </Text>
          {resource.title ? <Text className="text-ink-3 font-mono text-[10px]">— {resource.title}</Text> : null}
          <TagsRow tags={tags} />
        </View>
      </Pressable>
    );
  }

  // link
  const color = hashColor(resource.domain ?? title);
  const initial = (resource.domain ?? title).charAt(0).toUpperCase();
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} className={`${shell} p-3`}>
      <View className="gap-2">
        <View className="flex-row items-center gap-[7px]">
          <View className="h-[18px] w-[18px] items-center justify-center rounded-[5px]" style={{ backgroundColor: `${color}2e` }}>
            <Text style={{ color }} className="text-[9px] font-bold">{initial}</Text>
          </View>
          {resource.domain ? <Text className="text-ink-3 font-mono text-[10px]">{resource.domain}</Text> : null}
        </View>
        <Text className="text-ink text-[13.5px] font-semibold" style={{ lineHeight: 18 }}>{title}</Text>
        <TagsRow tags={tags} />
      </View>
    </Pressable>
  );
}
