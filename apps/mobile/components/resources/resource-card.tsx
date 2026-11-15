import { useThemeColors } from "@nox/features";
import type { Resource, Tag } from "@nox/types";
import { relativeAge } from "@nox/utils";
import { Archive, ArchiveRestore, Copy, ExternalLink, Image as ImageIcon, Link2, MoreHorizontal, Pencil, Play, Quote, Trash2 } from "lucide-react-native";
import { useRef, useState, type ReactNode } from "react";
import { Image, type ImageStyle, Platform, Pressable, type StyleProp, Text, View } from "react-native";
import { useSignedUrl } from "../../lib/storage";
import { TAG_PALETTE } from "../../lib/tag-palette";
import { useIsDesktop } from "../../lib/use-responsive";
import { MenuDivider, MenuRow } from "../menu";
import { Popover } from "../popover";

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

/** A thumbnail from a remote URL (og:image) or a private Storage path (a picked image), signed on demand. */
function Thumb({ value, style }: { value: string; style: StyleProp<ImageStyle> }) {
  const isRemote = /^(https?:|file:|data:)/.test(value);
  const { data: signed } = useSignedUrl("images", isRemote ? null : value);
  const uri = isRemote ? value : signed ?? null;
  if (!uri) return null;
  return <Image source={{ uri }} style={style} resizeMode="cover" />;
}

function Footer({ tags, resource }: { tags: Tag[]; resource: Resource }) {
  return (
    <View className="flex-row items-end gap-2">
      <View className="min-w-0 flex-1 flex-row flex-wrap gap-1">
        {tags.map((t) => (
          <View key={t.id} style={{ backgroundColor: `${t.color}1f` }} className="rounded-[6px] px-1.5 py-0.5">
            <Text style={{ color: t.color }} className="text-[11px] font-semibold">
              {t.name}
            </Text>
          </View>
        ))}
      </View>
      <Text className="text-ink-3 text-[11px]">{relativeAge(resource.created_at)}</Text>
    </View>
  );
}

export interface ResourceActions {
  onOpen: () => void;
  onEdit: () => void;
  onToggleUsed: () => void;
  onDelete: () => void;
}

/**
 * A resource in the masonry grid, drawn by type (link / video / image / snippet). Tapping opens it
 * (plays a video, opens a link, edits a snippet or picture); the ⋯ menu — always there on phones,
 * on hover on desktop — holds Open, Edit, Copy link, Mark as used and Delete. Long-press opens the
 * same menu on phones.
 */
export function ResourceCard({
  resource,
  tags,
  actions,
  layout = "card",
}: {
  resource: Resource;
  tags: Tag[];
  actions: ResourceActions;
  /** "row": one compact line for the list view. */
  layout?: "card" | "row";
}) {
  const c = useThemeColors();
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const anchor = useRef<View>(null);
  const web = Platform.OS === "web";
  // Hover-revealed only where there is a mouse; always shown on phones (web or native).
  const isDesktop = useIsDesktop();
  const hoverOnly = web && isDesktop;
  const title = resource.title ?? resource.url ?? "Untitled";
  const hasUrl = !!resource.url;
  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const menuButton = (onImage: boolean) => (
    <View ref={anchor} collapsable={false} className="absolute right-2 top-2" style={{ opacity: !hoverOnly || hover || menuOpen ? 1 : 0 }}>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.();
          setMenuOpen(true);
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Options for ${title}`}
        className={`h-7 w-7 items-center justify-center rounded-[8px] ${onImage ? "bg-black/55" : "bg-surface border-line border"}`}
      >
        <MoreHorizontal size={15} color={onImage ? "#fff" : c.ink2} strokeWidth={2.2} />
      </Pressable>
    </View>
  );

  const menu = (
      <Popover anchorRef={anchor} open={menuOpen} onClose={() => setMenuOpen(false)} width={220} accessibilityLabel="Resource options">
      <View className="p-1.5">
        {hasUrl && (
          <MenuRow label="Open" icon={<ExternalLink size={15} color={c.ink2} strokeWidth={2} />} trailing={<View />} onPress={run(actions.onOpen)} />
        )}
        <MenuRow label="Edit" icon={<Pencil size={15} color={c.ink2} strokeWidth={2} />} trailing={<View />} onPress={run(actions.onEdit)} />
        {hasUrl && web && typeof navigator !== "undefined" && !!navigator.clipboard && (
          <MenuRow
            label="Copy link"
            icon={<Copy size={15} color={c.ink2} strokeWidth={2} />}
            trailing={<View />}
            onPress={run(() => void navigator.clipboard.writeText(resource.url!).catch(() => {}))}
          />
        )}
        <MenuRow
          label={resource.is_archived ? "Move back to Saved" : "Mark as used"}
          icon={
            resource.is_archived ? (
              <ArchiveRestore size={15} color={c.ink2} strokeWidth={2} />
            ) : (
              <Archive size={15} color={c.ink2} strokeWidth={2} />
            )
          }
          trailing={<View />}
          onPress={run(actions.onToggleUsed)}
        />
        <MenuDivider />
        <MenuRow label="Delete" danger icon={<Trash2 size={15} color={c.high} strokeWidth={2} />} trailing={<View />} onPress={run(actions.onDelete)} />
      </View>
    </Popover>
  );

  if (layout === "row") {
    const typeIcon = { link: Link2, video: Play, image: ImageIcon, text: Quote }[resource.type];
    const TypeIcon = typeIcon ?? Link2;
    const thumb = resource.thumbnail_url;
    const domain = resource.domain ?? (resource.type === "text" ? "Snippet" : resource.type === "image" ? "Picture" : "");
    return (
      <View onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
        <Pressable
          onPress={actions.onOpen}
          onLongPress={() => setMenuOpen(true)}
          accessibilityRole={hasUrl ? "link" : "button"}
          className={`flex-row items-center gap-3 rounded-[10px] px-2.5 py-2 ${menuOpen ? "bg-chip" : "hover:bg-surface"}`}
        >
          <View className="bg-chip h-11 w-11 items-center justify-center overflow-hidden rounded-[9px]">
            {thumb ? <Thumb value={thumb} style={{ width: "100%", height: "100%" }} /> : <TypeIcon size={17} color={c.ink2} strokeWidth={2} />}
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className={`text-ink text-[15px] ${resource.type === "text" ? "font-serif" : "font-semibold"}`}>
              {resource.type === "text" ? `“${resource.body ?? title}”` : title}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              {domain ? (
                <Text numberOfLines={1} className="text-ink-3 text-[12px]">
                  {resource.type === "text" && resource.title ? `— ${resource.title}` : domain}
                </Text>
              ) : null}
              {tags.slice(0, 3).map((t) => (
                <View key={t.id} style={{ backgroundColor: `${t.color}1f` }} className="rounded-[6px] px-1.5 py-0.5">
                  <Text style={{ color: t.color }} className="text-[11px] font-semibold">
                    {t.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <Text className="text-ink-3 text-[12px]">{relativeAge(resource.created_at)}</Text>
          <View ref={anchor} collapsable={false} style={{ opacity: !hoverOnly || hover || menuOpen ? 1 : 0 }}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setMenuOpen(true);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Options for ${title}`}
              className="hover:bg-chip h-8 w-8 items-center justify-center rounded-[8px]"
            >
              <MoreHorizontal size={16} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
          </View>
        </Pressable>
        {menu}
      </View>
    );
  }

  let body: ReactNode;
  let media = false;
  if (resource.type === "video") {
    media = true;
    body = (
      <>
        <View className="bg-chip relative items-center justify-center" style={{ aspectRatio: 16 / 9 }}>
          {resource.thumbnail_url ? <Thumb value={resource.thumbnail_url} style={{ position: "absolute", inset: 0 } as ImageStyle} /> : null}
          <View className="h-10 w-10 items-center justify-center rounded-full bg-black/60">
            <Play size={15} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
          </View>
          {resource.duration ? (
            <View className="absolute bottom-2 right-2 rounded-[6px] bg-black/70 px-1.5 py-0.5">
              <Text className="text-[11px] font-semibold text-white">{resource.duration}</Text>
            </View>
          ) : null}
        </View>
        <View className="gap-2 px-3.5 pb-3 pt-3">
          <Text numberOfLines={3} className="text-ink text-[15px] font-semibold" style={{ lineHeight: 20 }}>
            {title}
          </Text>
          {resource.domain ? <Text className="text-ink-3 -mt-1 text-[12px]">{resource.domain}</Text> : null}
          <Footer tags={tags} resource={resource} />
        </View>
      </>
    );
  } else if (resource.type === "image") {
    media = true;
    body = (
      <>
        <View className="bg-chip h-[170px] items-center justify-center">
          {resource.thumbnail_url ? (
            <Thumb value={resource.thumbnail_url} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text className="text-ink-3 text-[12px]">No picture</Text>
          )}
        </View>
        <View className="gap-2 px-3.5 pb-3 pt-3">
          {resource.title ? (
            <Text numberOfLines={3} className="text-ink text-[14px] font-semibold" style={{ lineHeight: 19 }}>
              {resource.title}
            </Text>
          ) : null}
          <Footer tags={tags} resource={resource} />
        </View>
      </>
    );
  } else if (resource.type === "text") {
    body = (
      <View className="gap-2.5 px-3.5 pb-3 pt-3.5">
        <View className="flex-row gap-3 pr-6">
          <View className="bg-accent w-[3px] rounded-full" />
          <Text numberOfLines={8} className="text-ink flex-1 font-serif text-[15px]" style={{ lineHeight: 23 }}>
            {resource.body ?? title}
          </Text>
        </View>
        {resource.title && resource.body ? <Text className="text-ink-3 pl-[15px] text-[13px]">— {resource.title}</Text> : null}
        <Footer tags={tags} resource={resource} />
      </View>
    );
  } else {
    // link
    const domain = resource.domain ?? title;
    const color = hashColor(domain);
    const thumb = resource.thumbnail_url && /^https?:/.test(resource.thumbnail_url) ? resource.thumbnail_url : null;
    media = !!thumb;
    body = (
      <>
        {thumb ? (
          <View className="bg-chip" style={{ aspectRatio: 1.91 }}>
            <Thumb value={thumb} style={{ width: "100%", height: "100%" }} />
          </View>
        ) : null}
        <View className="gap-2 px-3.5 pb-3 pt-3">
          <View className="flex-row items-center gap-2 pr-7">
            <View className="h-5 w-5 items-center justify-center rounded-[6px]" style={{ backgroundColor: `${color}2e` }}>
              <Text style={{ color }} className="text-[11px] font-bold">
                {domain.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text numberOfLines={1} className="text-ink-3 flex-1 text-[12px]">
              {domain}
            </Text>
          </View>
          <Text numberOfLines={4} className="text-ink text-[15px] font-semibold" style={{ lineHeight: 20 }}>
            {title}
          </Text>
          <Footer tags={tags} resource={resource} />
        </View>
      </>
    );
  }

  return (
    <View onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} className="mb-3">
      <Pressable
        onPress={actions.onOpen}
        onLongPress={() => setMenuOpen(true)}
        accessibilityRole={hasUrl ? "link" : "button"}
        accessibilityHint="Opens it. The options button has Edit and more."
        className={`border-line bg-surface overflow-hidden rounded-[14px] border ${menuOpen ? "border-accent/[0.5]" : "hover:border-accent/[0.4]"}`}
      >
        {body}
      </Pressable>
      {menuButton(media)}

      {menu}
    </View>
  );
}
