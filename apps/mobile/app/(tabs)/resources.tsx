import {
  useArchiveResource,
  useCreateTag,
  useDeleteResource,
  useDeleteTag,
  useResources,
  useTags,
  useThemeColors,
  useThemeVars,
} from "@nox/features";
import type { Resource, Tag } from "@nox/types";
import { Bookmark, Search, SlidersHorizontal, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { classifySource } from "@nox/utils";
import { openExternal } from "../../lib/open-external";
import { VideoPlayer } from "../../components/resources/video-player";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fab, useHideOnScroll } from "../../components/fab";
import { DesktopHeader } from "../../components/desktop-header";
import { EmptyState } from "../../components/empty-state";
import { MasonrySkeleton } from "../../components/skeleton";
import { ProfileAvatar } from "../../components/profile-avatar";
import { ResourceCard } from "../../components/resources/resource-card";
import { NewResourceSheet } from "../../components/resources/new-resource-sheet";
import { confirmDelete, plural } from "../../lib/confirm";
import { nextTagColor } from "../../lib/tag-palette";
import { useIsDesktop } from "../../lib/use-responsive";

function matches(r: Resource, q: string, tagNames: string[]): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  if ([r.title, r.url, r.body, r.domain].some((v) => v?.toLowerCase().includes(n))) return true;
  return tagNames.some((t) => t.toLowerCase().includes(n));
}

/** Rough rendered height of a card (incl. gap), used only to balance the two masonry columns. */
function estimateCardHeight(r: Resource): number {
  const tagsH = r.tag_ids.length > 0 ? 26 : 0;
  switch (r.type) {
    case "image":
      return 210 + tagsH;
    case "video":
      return 180 + tagsH;
    case "text": {
      const lines = Math.min(6, Math.ceil(((r.body ?? r.title ?? "").length || 20) / 26));
      return 52 + lines * 20 + tagsH;
    }
    default: {
      const lines = Math.min(3, Math.ceil(((r.title ?? r.url ?? "").length || 10) / 24));
      return 64 + lines * 18 + tagsH;
    }
  }
}

/** A tag pill in the filter row. Tap toggles the filter; long-press (mobile) or the hover × (desktop,
 *  where there's no long-press) asks to delete it. */
function TagFilterPill({
  tag,
  selected,
  isDesktop,
  onToggle,
  onRequestDelete,
}: {
  tag: Tag;
  selected: boolean;
  isDesktop: boolean;
  onToggle: () => void;
  onRequestDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  const showX = isDesktop && hover;
  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onRequestDelete}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityHint="Hold to delete this tag"
      style={{ backgroundColor: selected ? tag.color : `${tag.color}1f` }}
      className={`rounded-pill flex-row items-center py-[7px] ${showX ? "pl-3 pr-1.5" : "px-3"}`}
    >
      <Text style={{ color: selected ? "#fff" : tag.color }} className="text-[12px] font-semibold">
        {tag.name}
      </Text>
      {showX && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onRequestDelete();
          }}
          accessibilityLabel={`Delete ${tag.name} tag`}
          hitSlop={6}
          className="ml-1 rounded-full"
        >
          <X size={13} color={selected ? "#fff" : tag.color} strokeWidth={2.4} />
        </Pressable>
      )}
    </Pressable>
  );
}

export default function ResourcesScreen() {
  const fab = useHideOnScroll();
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [menuFor, setMenuFor] = useState<Resource | null>(null);
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagMenuFor, setTagMenuFor] = useState<Tag | null>(null);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const tagsActive = selected.length > 0;

  const { data: resources = [], isLoading, isError, refetch } = useResources();
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const archiveResource = useArchiveResource();
  const deleteResource = useDeleteResource();
  const deleteTag = useDeleteTag();

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const resolveTags = (r: Resource): Tag[] => r.tag_ids.map((id) => tagsById.get(id)).filter(Boolean) as Tag[];

  const filtered = useMemo(
    () =>
      resources.filter(
        (r) =>
          r.is_archived === showArchived &&
          matches(r, search, r.tag_ids.map((id) => tagsById.get(id)?.name ?? "")) &&
          (selected.length === 0 || r.tag_ids.some((id) => selected.includes(id))),
      ),
    [resources, search, selected, showArchived, tagsById],
  );
  // Height-balanced masonry: place each card into whichever column is currently shorter (estimated),
  // instead of a strict alternation that leaves one column with a long trailing gap. 2 columns on
  // mobile, 3 on desktop.
  const columns = useMemo(() => {
    const n = isDesktop ? 3 : 2;
    const cols = Array.from({ length: n }, () => ({ items: [] as Resource[], h: 0 }));
    for (const r of filtered) {
      const target = cols.reduce((a, b) => (a.h <= b.h ? a : b));
      target.items.push(r);
      target.h += estimateCardHeight(r);
    }
    return cols.map((col) => col.items);
  }, [filtered, isDesktop]);

  const openResource = (r: Resource) => {
    if (r.type === "text" || !r.url) {
      setEditing(r);
      setSheetOpen(true);
      return;
    }
    // A trusted video plays inline (web/desktop only — native has no iframe yet). Everything else,
    // and every untrusted video, opens in the browser.
    const source = classifySource(r.url);
    if (Platform.OS === "web" && source?.kind === "video" && source.embedUrl) {
      setPlaying({ url: source.embedUrl, title: r.title ?? r.domain ?? "Video" });
    } else {
      void openExternal(r.url);
    }
  };
  const toggleTag = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const submitNewTag = () => {
    const name = tagName.trim();
    if (name) createTag.create({ name, color: nextTagColor(tags.length) });
    setTagName("");
    setNewTagOpen(false);
  };
  // Soft-deleting a tag just drops it from `useTags`, so its pill and any resolved chips vanish;
  // the dangling id left on a resource's tag_ids resolves to nothing and is harmless. Clear it from
  // the active filter too, or the filter would keep hiding everything by an id that no longer lists.
  const removeTag = (t: Tag) => {
    deleteTag.mutate(t.id);
    setSelected((s) => s.filter((x) => x !== t.id));
    setTagMenuFor(null);
  };
  const tagUsage = tagMenuFor ? resources.filter((r) => r.tag_ids.includes(tagMenuFor.id)).length : 0;

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView
        onScroll={fab.onScroll}
        scrollEventThrottle={16}
        className="flex-1" contentContainerStyle={{ paddingBottom: 150, ...(isDesktop ? { paddingHorizontal: 10, paddingTop: 28, maxWidth: 1020, width: "100%", alignSelf: "center" } : null) }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        {/* Header — desktop: 26px title + "New resource" pill; mobile: 30px title + tag toggle */}
        {isDesktop ? (
          <DesktopHeader
            eyebrow={`${resources.filter((r) => !r.is_archived).length} saved · ${plural(tags.length, "tag")}`}
            title="Resources"
            actionLabel="New resource"
            onAction={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          />
        ) : (
          <View className="px-screen flex-row items-start justify-between pt-2">
            <View>
              <Text className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">Resources</Text>
              <Text className="text-ink-3 mt-0.5 text-[13.5px] font-medium">
                {resources.filter((r) => !r.is_archived).length} saved · {plural(tags.length, "tag")}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setTagsOpen((v) => !v)}
                accessibilityLabel="Toggle tag filters"
                className={`rounded-pill h-[34px] w-[34px] items-center justify-center ${tagsOpen || tagsActive ? "bg-accent-soft" : "bg-chip"}`}
              >
                <SlidersHorizontal size={16} color={tagsOpen || tagsActive ? c.accent : c.ink2} strokeWidth={1.8} />
              </Pressable>
              <ProfileAvatar />
            </View>
          </View>
        )}

        {/* Search (mobile — desktop uses the sidebar's ⌘K) */}
        {!isDesktop && (
          <View className="px-screen mt-5">
            <View className="bg-chip rounded-input h-11 flex-row items-center gap-[10px] px-[13px]">
              <Search size={15} color={c.ink3} strokeWidth={1.8} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search links, media, snippets…"
                placeholderTextColor={c.ink3}
                className="text-ink flex-1 text-[14.5px]"
                style={{ paddingVertical: 0 }}
              />
            </View>
          </View>
        )}

        {/* Saved / Used — used resources are archived, not deleted, so they stay recoverable here. */}
        <View className="px-screen mt-3.5 flex-row items-center gap-1.5">
          <Pressable
            onPress={() => setShowArchived(false)}
            className={`rounded-pill px-3 py-[7px] ${!showArchived ? "bg-accent-soft" : "bg-chip border-line border"}`}
          >
            <Text className={`text-[12px] font-semibold ${!showArchived ? "text-accent" : "text-ink-2"}`}>Saved</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowArchived(true)}
            className={`rounded-pill px-3 py-[7px] ${showArchived ? "bg-accent-soft" : "bg-chip border-line border"}`}
          >
            <Text className={`text-[12px] font-semibold ${showArchived ? "text-accent" : "text-ink-2"}`}>Used</Text>
          </Pressable>
        </View>

        {/* Tag filter (always on desktop; collapsed behind the header toggle on mobile) */}
        {/* Desktop wraps; a phone scrolls the row sideways so a handful of tags doesn't strand
            "+ new tag" alone on a second line. */}
        {(isDesktop || tagsOpen) && (
          <ScrollView
            horizontal={!isDesktop}
            scrollEnabled={!isDesktop}
            showsHorizontalScrollIndicator={false}
            className="mt-3.5"
            contentContainerStyle={isDesktop ? undefined : { paddingHorizontal: 20 }}
          >
          <View className={`flex-row gap-1.5 ${isDesktop ? "px-screen flex-1 flex-wrap" : ""}`}>
            <Pressable
              onPress={() => setSelected([])}
              className={`rounded-pill px-3 py-[7px] ${selected.length === 0 ? "bg-accent" : "bg-chip border-line border"}`}
            >
              <Text className={`text-[12px] font-semibold ${selected.length === 0 ? "text-on-accent" : "text-ink-2"}`}>All</Text>
            </Pressable>
            {tags.map((t) => (
              <TagFilterPill
                key={t.id}
                tag={t}
                selected={selected.includes(t.id)}
                isDesktop={isDesktop}
                onToggle={() => toggleTag(t.id)}
                onRequestDelete={() => setTagMenuFor(t)}
              />
            ))}
            <Pressable onPress={() => setNewTagOpen(true)} className="border-line rounded-pill border border-dashed px-3 py-[6px]">
              <Text className="text-ink-3 text-[12px] font-semibold">+ new tag</Text>
            </Pressable>
          </View>
          </ScrollView>
        )}

        {/* Masonry */}
        <View className="px-screen mt-4">
          {isError && resources.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="Couldn't load your resources"
              subtitle="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          ) : isLoading && resources.length === 0 ? (
            <MasonrySkeleton />
          ) : filtered.length === 0 ? (
            search || selected.length ? (
              <EmptyState icon={Search} title="No resources match" subtitle="Try a different search or tag." />
            ) : showArchived ? (
              <EmptyState
                icon={Bookmark}
                title="No used resources"
                subtitle="Resources you mark as used collect here — you can restore or delete them."
              />
            ) : (
              <EmptyState
                icon={Bookmark}
                title="Save your first resource"
                subtitle="Keep links, images, videos, and snippets in one searchable place."
                actionLabel="Add resource"
                onAction={() => {
                  setEditing(null);
                  setSheetOpen(true);
                }}
              />
            )
          ) : (
            <View className="flex-row gap-[11px]">
              {columns.map((col, ci) => (
                <View key={ci} className="flex-1">
                  {col.map((r) => (
                    <ResourceCard key={r.id} resource={r} tags={resolveTags(r)} onPress={() => openResource(r)} onLongPress={() => setMenuFor(r)} />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB (mobile; desktop creates from the header +) */}
      {!isDesktop && (
        <Fab onPress={() => {
            setEditing(null);
            setSheetOpen(true);
          }} label="New resource" bottom={112} visible={fab.visible} />
      )}

      {/* New / edit resource sheet */}
      <NewResourceSheet visible={sheetOpen} resource={editing} tags={tags} onClose={() => setSheetOpen(false)} />

      <VideoPlayer embedUrl={playing?.url ?? null} title={playing?.title} onClose={() => setPlaying(null)} />

      {/* Long-press menu */}
      <Modal transparent visible={!!menuFor} animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable onPress={() => setMenuFor(null)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-10">
          <View className="border-line bg-elev rounded-card w-full max-w-[280px] overflow-hidden border">
            <Pressable
              onPress={() => {
                setEditing(menuFor);
                setMenuFor(null);
                setSheetOpen(true);
              }}
              className="border-line border-b px-4 py-3"
            >
              <Text className="text-ink text-[14.5px]">Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (menuFor) archiveResource.mutate({ id: menuFor.id, isArchived: !menuFor.is_archived });
                setMenuFor(null);
              }}
              className="border-line border-b px-4 py-3"
            >
              <Text className="text-ink text-[14.5px]">
                {menuFor?.is_archived ? "Mark as unused" : "Mark as used"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const target = menuFor;
                setMenuFor(null);
                if (!target) return;
                confirmDelete({
                  title: "Delete resource?",
                  message: `“${target.title ?? target.url ?? "This resource"}” will be deleted on all your devices.${
                    target.is_archived ? "" : " Mark as used keeps it instead."
                  }`,
                  onConfirm: () => deleteResource.mutate(target.id),
                });
              }}
              className="px-4 py-3"
            >
              <Text className="text-high text-[14.5px]">Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Delete tag confirmation (long-press a tag pill) */}
      <Modal transparent visible={!!tagMenuFor} animationType="fade" onRequestClose={() => setTagMenuFor(null)}>
        <Pressable onPress={() => setTagMenuFor(null)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
          <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[380px] border p-4">
            <Text className="text-ink mb-1.5 text-[15px] font-semibold">
              Delete “{tagMenuFor?.name}”?
            </Text>
            <Text className="text-ink-2 mb-4 text-[13px] leading-[19px]">
              {tagUsage > 0
                ? `This tag is on ${tagUsage} resource${tagUsage === 1 ? "" : "s"}. They stay — only the tag is removed.`
                : "This tag isn't on any resources."}
            </Text>
            <View className="flex-row justify-end gap-2">
              <Pressable onPress={() => setTagMenuFor(null)} className="px-4 py-2">
                <Text className="text-ink-2 text-[14px]">Cancel</Text>
              </Pressable>
              <Pressable onPress={() => tagMenuFor && removeTag(tagMenuFor)} className="bg-high-soft rounded-input px-4 py-2">
                <Text className="text-high text-[14px] font-semibold">Delete tag</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* New tag modal */}
      <Modal transparent visible={newTagOpen} animationType="fade" onRequestClose={() => setNewTagOpen(false)}>
        <Pressable onPress={() => setNewTagOpen(false)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
          <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[380px] border p-4">
            <Text className="text-ink mb-3 text-[15px] font-semibold">New tag</Text>
            <TextInput
              autoFocus
              value={tagName}
              onChangeText={setTagName}
              onSubmitEditing={submitNewTag}
              returnKeyType="done"
              placeholder="Tag name"
              placeholderTextColor={c.ink3}
              className="bg-chip rounded-input text-ink mb-3 h-11 px-3 text-[14px]"
              style={{ paddingVertical: 0 }}
            />
            <View className="flex-row justify-end gap-2">
              <Pressable onPress={() => setNewTagOpen(false)} className="px-4 py-2">
                <Text className="text-ink-2 text-[14px]">Cancel</Text>
              </Pressable>
              <Pressable onPress={submitNewTag} className="bg-accent rounded-input px-4 py-2">
                <Text className="text-on-accent text-[14px] font-semibold">Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
