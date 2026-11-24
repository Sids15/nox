import {
  useArchiveResource,
  useCreateResource,
  useCreateTag,
  useDeleteResource,
  useDeleteTag,
  useResources,
  useTags,
  useThemeColors,
  useUpdateResource,
  useUpdateTag,
} from "@nox/features";
import type { Resource, Tag } from "@nox/types";
import { classifySource, domainFrom } from "@nox/utils";
import type { LucideIcon } from "lucide-react-native";
import {
  ArrowDownUp,
  Bookmark,
  Image as ImageIcon,
  LayoutGrid,
  Library,
  Link2,
  List,
  MoreHorizontal,
  Play,
  Plus,
  Quote,
  Search,
  ListFilter,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ResizablePane } from "../../components/resizable-pane";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../components/empty-state";
import { Fab, useHideOnScroll } from "../../components/fab";
import { MenuDivider, MenuLabel, MenuRow, pressScale, TABULAR } from "../../components/menu";
import { Popover } from "../../components/popover";
import { ProfileAvatar } from "../../components/profile-avatar";
import { NewResourceSheet } from "../../components/resources/new-resource-sheet";
import { ResourceCard, type ResourceActions } from "../../components/resources/resource-card";
import { TAG_COLORS, TagDialog } from "../../components/resources/tag-dialog";
import { VideoPlayer } from "../../components/resources/video-player";
import { MasonrySkeleton } from "../../components/skeleton";
import { confirmDelete, plural } from "../../lib/confirm";
import { openExternal } from "../../lib/open-external";
import { useIsDesktop } from "../../lib/use-responsive";
import { fetchUrlMeta, videoThumbnail } from "../../lib/url-meta";

type Kind = "all" | Resource["type"];
type Sort = "newest" | "oldest" | "title";
const KINDS: { key: Kind; label: string; Icon: LucideIcon }[] = [
  { key: "all", label: "Everything", Icon: Library },
  { key: "link", label: "Links", Icon: Link2 },
  { key: "video", label: "Videos", Icon: Play },
  { key: "image", label: "Pictures", Icon: ImageIcon },
  { key: "text", label: "Snippets", Icon: Quote },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "title", label: "Title A–Z" },
];

function matches(r: Resource, q: string, tagNames: string[]): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  if ([r.title, r.url, r.body, r.domain].some((v) => v?.toLowerCase().includes(n))) return true;
  return tagNames.some((t) => t.toLowerCase().includes(n));
}

/** Rough rendered height of a card (incl. gap), used only to balance the masonry columns. */
function estimateCardHeight(r: Resource): number {
  const tagsH = r.tag_ids.length > 0 ? 26 : 0;
  switch (r.type) {
    case "image":
      return 230 + (r.title ? 40 : 0) + tagsH;
    case "video":
      return 200 + tagsH;
    case "text": {
      const lines = Math.min(8, Math.ceil(((r.body ?? r.title ?? "").length || 20) / 30));
      return 60 + lines * 23 + (r.title && r.body ? 20 : 0) + tagsH;
    }
    default: {
      const lines = Math.min(4, Math.ceil(((r.title ?? r.url ?? "").length || 10) / 26));
      const thumb = r.thumbnail_url && /^https?:/.test(r.thumbnail_url) ? 150 : 0;
      return 80 + lines * 20 + thumb + tagsH;
    }
  }
}

/** Looks like a web address someone pasted. */
const looksLikeUrl = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim());

/** A row in the desktop library rail. */
function RailRow({
  icon,
  dot,
  label,
  count,
  active,
  onPress,
  trailing,
}: {
  icon?: LucideIcon;
  dot?: string;
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  const c = useThemeColors();
  const Icon = icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`group h-[36px] flex-row items-center gap-2.5 rounded-[10px] px-[11px] ${active ? "bg-accent/[0.12]" : "hover:bg-chip"}`}
    >
      {Icon ? <Icon size={15} color={active ? c.accent : c.ink2} strokeWidth={2} /> : <View className="mx-[3px] h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot }} />}
      <Text numberOfLines={1} className={`flex-1 text-[14px] ${active ? "text-accent font-semibold" : "text-ink-2 font-medium"}`}>
        {label}
      </Text>
      {trailing}
      <Text style={TABULAR} className="text-ink-3 text-[12px]">
        {count}
      </Text>
    </Pressable>
  );
}

/**
 * Resources: everything worth keeping — links, videos, pictures, snippets.
 *
 * Desktop is a library: a rail on the left (what kind, Saved or Used, and your tags with counts — each
 * tag editable), and the collection on the right with a paste-to-save field, search, sort, and a grid
 * or list view. Phones keep the same filters as chip rows. Tags have a name and a colour you choose,
 * and can be renamed, recoloured or deleted from the rail, the chip row (long-press) or "Manage tags".
 */
export default function ResourcesScreen() {
  const fab = useHideOnScroll();
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [tagId, setTagId] = useState<string | null>(null);
  const [showUsed, setShowUsed] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<View>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);
  const [tagDialog, setTagDialog] = useState<{ tag: Tag | null } | null>(null);
  const [quick, setQuick] = useState("");
  const [phoneMenu, setPhoneMenu] = useState(false);
  const phoneMenuRef = useRef<View>(null);
  // The phone field hands a pasted link to quick save (desktop has its own paste field).
  useEffect(() => {
    if (!isDesktop && quick && looksLikeUrl(quick)) void quickSave();
  }, [quick]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: resources = [], isLoading, isError, refetch } = useResources();
  const { data: tags = [] } = useTags();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const archiveResource = useArchiveResource();
  const deleteResource = useDeleteResource();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const resolveTags = (r: Resource): Tag[] => r.tag_ids.map((id) => tagsById.get(id)).filter(Boolean) as Tag[];
  const inStatus = useMemo(() => resources.filter((r) => r.is_archived === showUsed), [resources, showUsed]);
  const savedCount = resources.filter((r) => !r.is_archived).length;
  const usedCount = resources.length - savedCount;
  const kindCount = (k: Kind) => (k === "all" ? inStatus.length : inStatus.filter((r) => r.type === k).length);
  const tagCount = (id: string) => inStatus.filter((r) => r.tag_ids.includes(id)).length;
  const activeTag = tagId ? tagsById.get(tagId) ?? null : null;

  // On phones the one field also takes pasted links; a link waiting to be saved isn't a search.
  const query = !isDesktop && looksLikeUrl(search) ? "" : search;
  const filtered = useMemo(() => {
    const list = inStatus.filter(
      (r) =>
        (kind === "all" || r.type === kind) &&
        (!tagId || r.tag_ids.includes(tagId)) &&
        matches(r, query, r.tag_ids.map((id) => tagsById.get(id)?.name ?? "")),
    );
    const title = (r: Resource) => (r.title ?? r.body ?? r.url ?? "").toLowerCase();
    return list.sort((a, b) =>
      sort === "title" ? title(a).localeCompare(title(b)) : sort === "oldest" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at),
    );
  }, [inStatus, kind, tagId, query, sort, tagsById]);

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

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openResource = (r: Resource) => {
    if (r.type === "text" || !r.url) {
      setEditing(r);
      setSheetOpen(true);
      return;
    }
    const source = classifySource(r.url);
    if (Platform.OS === "web" && source?.kind === "video" && source.embedUrl) {
      setPlaying({ url: source.embedUrl, title: r.title ?? r.domain ?? "Video" });
    } else void openExternal(r.url);
  };
  const actionsFor = (r: Resource): ResourceActions => ({
    onOpen: () => openResource(r),
    onEdit: () => {
      setEditing(r);
      setSheetOpen(true);
    },
    onToggleUsed: () => archiveResource.mutate({ id: r.id, isArchived: !r.is_archived }),
    onDelete: () =>
      confirmDelete({
        title: "Delete resource?",
        message: `“${r.title ?? r.url ?? "This resource"}” will be deleted on all your devices.${r.is_archived ? "" : " Mark as used keeps it instead."}`,
        onConfirm: () => deleteResource.mutate(r.id),
      }),
  });

  /** Paste a link, press Enter: it's saved (as a video if it is one, tagged with the active tag),
   *  and its title fills in when the preview arrives. */
  const quickSave = async () => {
    const raw = quick.trim();
    if (!looksLikeUrl(raw)) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const thumb = videoThumbnail(url) ?? null;
    const id = createResource.create({
      type: thumb ? "video" : "link",
      url,
      title: null,
      domain: domainFrom(url),
      thumbnail_url: thumb,
      duration: null,
      body: null,
      tag_ids: tagId ? [tagId] : [],
    });
    setQuick("");
    if (showUsed) setShowUsed(false);
    const meta = await fetchUrlMeta(url);
    if (meta?.title || (meta?.image && !thumb))
      updateResource.mutate({ id, patch: { title: meta.title ?? null, ...(meta.image && !thumb ? { thumbnail_url: meta.image } : {}) } });
  };

  const tagUsage = (t: Tag) => resources.filter((r) => r.tag_ids.includes(t.id)).length;
  const saveTag = (name: string, color: string) => {
    const t = tagDialog?.tag;
    if (t) updateTag.mutate({ id: t.id, patch: { name, color } });
    else createTag.create({ name, color });
  };

  const scopeTitle = activeTag ? activeTag.name : kind === "all" ? "Resources" : KINDS.find((k) => k.key === kind)!.label;

  // ── Pieces ──────────────────────────────────────────────────────────────────────────────────────
  const quickBar = (
    <View className="border-line bg-surface h-[46px] flex-row items-center gap-2.5 rounded-[12px] border px-3.5">
      <Link2 size={16} color={looksLikeUrl(quick) ? c.accent : c.ink3} strokeWidth={2} />
      <TextInput
        value={quick}
        onChangeText={setQuick}
        onSubmitEditing={() => void quickSave()}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder={activeTag ? `Paste a link to save it to ${activeTag.name}…` : "Paste a link and press Enter to save it…"}
        placeholderTextColor={c.ink3}
        accessibilityLabel="Paste a link to save"
        className="text-ink flex-1 text-[15px]"
        style={{ paddingVertical: 0, outlineWidth: 0 } as object}
      />
      {looksLikeUrl(quick) ? (
        <Pressable onPress={() => void quickSave()} style={pressScale} className="bg-accent h-8 justify-center rounded-[8px] px-3" accessibilityRole="button">
          <Text className="text-on-accent text-[13px] font-semibold">Save</Text>
        </Pressable>
      ) : quick ? (
        <Text className="text-ink-3 text-[12px]">Not a link</Text>
      ) : null}
    </View>
  );

  const toolbar = (
    <View className="flex-row items-center gap-2">
      <View className="border-line bg-surface min-w-0 flex-1 flex-row items-center gap-2.5 rounded-[11px] border px-3" style={{ height: 40 }}>
        <Search size={15} color={c.ink3} strokeWidth={2} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search titles, sites, snippets, tags…"
          placeholderTextColor={c.ink3}
          accessibilityLabel="Search resources"
          className="text-ink flex-1 text-[14px]"
          style={{ paddingVertical: 0, outlineWidth: 0 } as object}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <X size={15} color={c.ink3} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
      <View ref={sortRef} collapsable={false}>
        <Pressable
          onPress={() => setSortOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort: ${SORTS.find((s) => s.key === sort)!.label}`}
          className={`h-[40px] flex-row items-center gap-1.5 rounded-[11px] px-2.5 ${sortOpen ? "bg-chip" : "hover:bg-chip"}`}
        >
          <ArrowDownUp size={15} color={c.ink2} strokeWidth={2} />
          {isDesktop && <Text className="text-ink-2 text-[13px] font-semibold">{SORTS.find((s) => s.key === sort)!.label}</Text>}
        </Pressable>
      </View>
      <View className="bg-chip flex-row rounded-[10px] p-0.5" accessibilityRole="tablist">
        {([
          { key: "grid", Icon: LayoutGrid, label: "Grid" },
          { key: "list", Icon: List, label: "List" },
        ] as const).map(({ key, Icon, label }) => (
          <Pressable
            key={key}
            onPress={() => setView(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === key }}
            accessibilityLabel={`${label} view`}
            className={`h-[34px] w-[34px] items-center justify-center rounded-[8px] ${view === key ? "bg-surface" : ""}`}
          >
            <Icon size={15} color={view === key ? c.ink : c.ink3} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
      <Popover anchorRef={sortRef} open={sortOpen} onClose={() => setSortOpen(false)} width={200} accessibilityLabel="Sort">
        <View className="p-1.5">
          <MenuLabel>Sort</MenuLabel>
          {SORTS.map((s) => (
            <MenuRow
              key={s.key}
              label={s.label}
              selected={sort === s.key}
              onPress={() => {
                setSort(s.key);
                setSortOpen(false);
              }}
            />
          ))}
        </View>
      </Popover>
    </View>
  );

  let body: React.ReactNode;
  if (isError && resources.length === 0) {
    body = <EmptyState icon={Bookmark} title="Couldn't load your resources" subtitle="Check your connection and try again." actionLabel="Try again" onAction={() => refetch()} />;
  } else if (isLoading && resources.length === 0) {
    body = <MasonrySkeleton />;
  } else if (filtered.length === 0) {
    body =
      query || tagId || kind !== "all" ? (
        <EmptyState icon={Search} title="Nothing here" subtitle="Try another search, kind or tag." />
      ) : showUsed ? (
        <EmptyState icon={Bookmark} title="Nothing used yet" subtitle="Mark a resource as used and it moves here, out of the way but kept." />
      ) : (
        <EmptyState
          icon={Bookmark}
          title="Save your first resource"
          subtitle="Paste a link above, or add a video, a picture or a snippet worth keeping."
          actionLabel="Add resource"
          onAction={openNew}
        />
      );
  } else if (view === "list") {
    body = (
      <View className="gap-0.5">
        {filtered.map((r) => (
          <ResourceCard key={r.id} layout="row" resource={r} tags={resolveTags(r)} actions={actionsFor(r)} />
        ))}
      </View>
    );
  } else {
    body = (
      <View className="flex-row gap-3">
        {columns.map((col, ci) => (
          <View key={ci} className="flex-1">
            {col.map((r) => (
              <ResourceCard key={r.id} resource={r} tags={resolveTags(r)} actions={actionsFor(r)} />
            ))}
          </View>
        ))}
      </View>
    );
  }

  const overlays = (
    <>
      <NewResourceSheet visible={sheetOpen} resource={editing} tags={tags} onClose={() => setSheetOpen(false)} />
      <VideoPlayer embedUrl={playing?.url ?? null} title={playing?.title} onClose={() => setPlaying(null)} />
      <TagDialog
        visible={!!tagDialog}
        tag={tagDialog?.tag ?? null}
        usage={tagDialog?.tag ? tagUsage(tagDialog.tag) : 0}
        defaultColor={TAG_COLORS[tags.length % TAG_COLORS.length]!}
        existingNames={tags.filter((t) => t.id !== tagDialog?.tag?.id).map((t) => t.name.toLowerCase())}
        onSave={saveTag}
        onDelete={() => {
          const t = tagDialog?.tag;
          if (!t) return;
          deleteTag.mutate(t.id);
          if (tagId === t.id) setTagId(null);
        }}
        onClose={() => setTagDialog(null)}
      />
    </>
  );

  // ── Desktop: library rail + collection ──────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        <View className="flex-1 flex-row">
          <ResizablePane id="resources.library" initial={236} min={180} max={360} className="border-line border-r px-2 pt-6">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text className="text-ink px-[11px] font-serif text-[20px] font-bold">Library</Text>
              <View className="mt-3 gap-0.5">
                {KINDS.map((k) => (
                  <RailRow key={k.key} icon={k.Icon} label={k.label} count={kindCount(k.key)} active={kind === k.key && !tagId} onPress={() => { setKind(k.key); setTagId(null); }} />
                ))}
              </View>

              <View className="mt-5 gap-0.5">
                <Text className="text-ink-2 mb-1 px-[11px] text-[13px] font-semibold">Status</Text>
                <RailRow icon={Bookmark} label="Saved" count={savedCount} active={!showUsed} onPress={() => setShowUsed(false)} />
                <RailRow icon={Library} label="Used" count={usedCount} active={showUsed} onPress={() => setShowUsed(true)} />
              </View>

              <View className="mt-5">
                <View className="mb-1 flex-row items-center justify-between px-[11px]">
                  <Text className="text-ink-2 text-[13px] font-semibold">Tags</Text>
                  <Pressable onPress={() => setTagDialog({ tag: null })} accessibilityRole="button" accessibilityLabel="New tag" className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]">
                    <Plus size={14} color={c.ink2} strokeWidth={2.2} />
                  </Pressable>
                </View>
                <View className="gap-0.5">
                  {tags.map((t) => (
                    <RailRow
                      key={t.id}
                      dot={t.color}
                      label={t.name}
                      count={tagCount(t.id)}
                      active={tagId === t.id}
                      onPress={() => setTagId(tagId === t.id ? null : t.id)}
                      trailing={
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setTagDialog({ tag: t });
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit tag ${t.name}`}
                          className="hover:bg-surface h-6 w-6 items-center justify-center rounded-[6px]"
                        >
                          <MoreHorizontal size={14} color={c.ink3} strokeWidth={2} />
                        </Pressable>
                      }
                    />
                  ))}
                  {tags.length === 0 && (
                    <Pressable onPress={() => setTagDialog({ tag: null })} className="hover:bg-chip rounded-[10px] px-[11px] py-2">
                      <Text className="text-ink-3 text-[13px]">Make a tag to group what you save.</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </ScrollView>
          </ResizablePane>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80, paddingTop: 28, paddingHorizontal: 30, maxWidth: 1080, width: "100%", alignSelf: "center" }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center gap-2.5">
                  {activeTag && <View className="h-3 w-3 rounded-full" style={{ backgroundColor: activeTag.color }} />}
                  <Text className="text-ink font-serif text-[30px] font-bold leading-[36px]">{scopeTitle}</Text>
                </View>
                <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[14px] font-medium">
                  {plural(filtered.length, "resource")}
                  {showUsed ? " · used" : ""}
                  {activeTag && kind !== "all" ? ` · ${KINDS.find((k) => k.key === kind)!.label.toLowerCase()}` : ""}
                </Text>
              </View>
              <Pressable onPress={openNew} accessibilityRole="button" accessibilityLabel="New resource" style={pressScale} className="bg-accent hover:opacity-90 mt-1 h-[36px] flex-row items-center gap-1.5 rounded-[10px] px-3.5">
                <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
                <Text className="text-on-accent text-[14px] font-semibold">New resource</Text>
              </Pressable>
            </View>
            <View className="mt-5">{quickBar}</View>
            <View className="mt-3">{toolbar}</View>
            <View className="mt-5">{body}</View>
          </ScrollView>
        </View>
        {overlays}
      </SafeAreaView>
    );
  }

  // ── Phone ───────────────────────────────────────────────────────────────────────────────────────
  const chip = (on: boolean, label: string, onPress: () => void, color?: string, onLongPress?: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      className="rounded-pill px-3 py-[6px]"
      style={{ backgroundColor: color ? (on ? color : `${color}1f`) : on ? c.ink : c.chip }}
    >
      <Text style={{ color: color ? (on ? "#fff" : color) : on ? c.bg : c.ink2 }} className="text-[13px] font-semibold">
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView onScroll={fab.onScroll} scrollEventThrottle={16} className="flex-1" contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <View className="px-screen flex-row items-start justify-between pt-2">
          <View className="flex-1 pr-3">
            <Text className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">
              {showUsed ? "Used" : "Resources"}
            </Text>
            <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[14px] font-medium">
              {showUsed ? plural(usedCount, "resource") : `${savedCount} saved · ${plural(tags.length, "tag")}`}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 pt-1">
            {/* Saved / Used, sort and layout live in one menu on phones — rows of controls pushed the
                first card halfway down the screen. */}
            <View ref={phoneMenuRef} collapsable={false}>
              <Pressable
                onPress={() => setPhoneMenu(true)}
                accessibilityRole="button"
                accessibilityLabel="View options"
                style={pressScale}
                className={`h-[34px] w-[34px] items-center justify-center rounded-[10px] ${phoneMenu || showUsed || sort !== "newest" || view === "list" ? "bg-accent/[0.14]" : ""}`}
              >
                <ListFilter size={17} color={showUsed || sort !== "newest" || view === "list" ? c.accent : c.ink2} strokeWidth={2} />
              </Pressable>
            </View>
            <ProfileAvatar />
          </View>
        </View>

        {/* One field: it searches as you type, and a pasted link gets a Save button. */}
        <View className="px-screen mt-4">
          <View className="bg-surface border-line h-[46px] flex-row items-center gap-2.5 rounded-[12px] border px-3">
            {looksLikeUrl(search) ? <Link2 size={16} color={c.accent} strokeWidth={2} /> : <Search size={16} color={c.ink3} strokeWidth={2} />}
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => {
                if (looksLikeUrl(search)) {
                  setQuick(search);
                  setSearch("");
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Search, or paste a link to save"
              placeholderTextColor={c.ink3}
              accessibilityLabel="Search resources or paste a link to save"
              enterKeyHint={looksLikeUrl(search) ? "done" : "search"}
              className="text-ink flex-1 text-[15px]"
              style={{ paddingVertical: 0, outlineWidth: 0 } as object}
            />
            {looksLikeUrl(search) ? (
              <Pressable
                onPress={() => {
                  setQuick(search);
                  setSearch("");
                }}
                accessibilityRole="button"
                style={pressScale}
                className="bg-accent h-8 justify-center rounded-[9px] px-3"
              >
                <Text className="text-on-accent text-[13px] font-semibold">Save link</Text>
              </Pressable>
            ) : search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <X size={16} color={c.ink3} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* One row of filters: what kind, then your tags (hold a tag to edit it). */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ paddingHorizontal: 20, gap: 6, alignItems: "center" }}>
          {KINDS.map((k) => chip(kind === k.key, k.key === "all" ? "All" : k.label, () => setKind(k.key)))}
          {tags.length > 0 && <View className="bg-line mx-1 h-5 w-px" />}
          {tags.map((t) => chip(tagId === t.id, t.name, () => setTagId(tagId === t.id ? null : t.id), t.color, () => setTagDialog({ tag: t })))}
          <Pressable onPress={() => setTagDialog({ tag: null })} accessibilityRole="button" accessibilityLabel="New tag" className="flex-row items-center gap-1 px-2 py-[6px]">
            <Plus size={13} color={c.ink3} strokeWidth={2.2} />
            <Text className="text-ink-3 text-[13px] font-semibold">Tag</Text>
          </Pressable>
        </ScrollView>

        <Popover anchorRef={phoneMenuRef} open={phoneMenu} onClose={() => setPhoneMenu(false)} width={250} accessibilityLabel="View options">
          <View className="p-1.5">
            <MenuLabel>Show</MenuLabel>
            <MenuRow label="Saved" hint={String(savedCount)} selected={!showUsed} onPress={() => setShowUsed(false)} />
            <MenuRow label="Used" hint={String(usedCount)} selected={showUsed} onPress={() => setShowUsed(true)} />
            <MenuDivider />
            <MenuLabel>Sort</MenuLabel>
            {SORTS.map((o) => (
              <MenuRow key={o.key} label={o.label} selected={sort === o.key} onPress={() => setSort(o.key)} />
            ))}
            <MenuDivider />
            <MenuLabel>Layout</MenuLabel>
            <MenuRow label="Cards" icon={<LayoutGrid size={15} color={c.ink2} strokeWidth={2} />} selected={view === "grid"} onPress={() => setView("grid")} />
            <MenuRow label="List" icon={<List size={15} color={c.ink2} strokeWidth={2} />} selected={view === "list"} onPress={() => setView("list")} />
            {tags.length > 0 && (
              <>
                <MenuDivider />
                <Text className="text-ink-3 px-2.5 py-1.5 text-[12px] leading-[17px]">Hold a tag chip to rename, recolour or delete it.</Text>
              </>
            )}
          </View>
        </Popover>

        <View className="px-screen mt-4">{body}</View>
      </ScrollView>
      <Fab onPress={openNew} label="New resource" bottom={112} visible={fab.visible} />
      {overlays}
    </SafeAreaView>
  );
}
