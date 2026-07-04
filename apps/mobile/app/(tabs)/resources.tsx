import {
  useCreateTag,
  useDeleteResource,
  useResources,
  useTags,
  useThemeColors,
  useThemeVars,
} from "@nox/features";
import type { Resource, Tag } from "@nox/types";
import { Plus, Search, Tags } from "lucide-react-native";
import { vars } from "nativewind";
import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileAvatar } from "../../components/profile-avatar";
import { ResourceCard } from "../../components/resources/resource-card";
import { NewResourceSheet } from "../../components/resources/new-resource-sheet";
import { nextTagColor } from "../../lib/tag-palette";

function matches(r: Resource, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return [r.title, r.url, r.body, r.domain].some((v) => v?.toLowerCase().includes(n));
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

export default function ResourcesScreen() {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [menuFor, setMenuFor] = useState<Resource | null>(null);
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [tagName, setTagName] = useState("");

  const { data: resources = [], isLoading } = useResources();
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const deleteResource = useDeleteResource();

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const resolveTags = (r: Resource): Tag[] => r.tag_ids.map((id) => tagsById.get(id)).filter(Boolean) as Tag[];

  const filtered = useMemo(
    () =>
      resources.filter(
        (r) =>
          !r.is_archived &&
          matches(r, search) &&
          (selected.length === 0 || r.tag_ids.some((id) => selected.includes(id))),
      ),
    [resources, search, selected],
  );
  // Height-balanced masonry: place each card into whichever column is currently shorter (estimated),
  // instead of a strict left/right alternation that leaves one column with a long trailing gap.
  const [colA, colB] = useMemo(() => {
    const cols = [
      { items: [] as Resource[], h: 0 },
      { items: [] as Resource[], h: 0 },
    ];
    for (const r of filtered) {
      const target = cols[0]!.h <= cols[1]!.h ? cols[0]! : cols[1]!;
      target.items.push(r);
      target.h += estimateCardHeight(r);
    }
    return [cols[0]!.items, cols[1]!.items];
  }, [filtered]);

  const openResource = (r: Resource) => {
    if (r.url && r.type !== "text") Linking.openURL(r.url.startsWith("http") ? r.url : `https://${r.url}`);
    else {
      setEditing(r);
      setSheetOpen(true);
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

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-screen flex-row items-start justify-between pt-2">
          <View>
            <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">
              {resources.filter((r) => !r.is_archived).length} SAVED · {tags.length} TAGS
            </Text>
            <Text className="text-ink mt-[3px] text-[30px] font-bold leading-[33px] tracking-[-0.02em]">Resources</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
              <Tags size={16} color={c.ink2} strokeWidth={1.8} />
            </Pressable>
            <ProfileAvatar />
          </View>
        </View>

        {/* Search */}
        <View className="px-screen mt-[14px]">
          <View className="bg-chip rounded-input h-10 flex-row items-center gap-[10px] px-[13px]">
            <Search size={15} color={c.ink3} strokeWidth={1.8} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search links, media, snippets…"
              placeholderTextColor={c.ink3}
              className="text-ink flex-1 text-[14.5px]"
            />
          </View>
        </View>

        {/* Tag filter */}
        <View className="px-screen mt-3 flex-row flex-wrap gap-1.5">
          <Pressable
            onPress={() => setSelected([])}
            className={`rounded-pill px-3 py-[7px] ${selected.length === 0 ? "bg-accent" : "bg-chip border-line border"}`}
          >
            <Text className={`text-[12px] font-semibold ${selected.length === 0 ? "text-on-accent" : "text-ink-2"}`}>All</Text>
          </Pressable>
          {tags.map((t) => {
            const on = selected.includes(t.id);
            return (
              <Pressable key={t.id} onPress={() => toggleTag(t.id)} style={{ backgroundColor: on ? t.color : `${t.color}1f` }} className="rounded-pill px-3 py-[7px]">
                <Text style={{ color: on ? "#fff" : t.color }} className="text-[12px] font-semibold">{t.name}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setNewTagOpen(true)} className="border-line rounded-pill border border-dashed px-3 py-[6px]">
            <Text className="text-ink-3 text-[12px] font-semibold">+ new tag</Text>
          </Pressable>
        </View>

        {/* Masonry */}
        <View className="px-screen mt-4">
          {isLoading && resources.length === 0 ? (
            <View className="mt-16 items-center">
              <ActivityIndicator color={c.accent} />
            </View>
          ) : filtered.length === 0 ? (
            <Text className="text-ink-3 mt-10 text-center text-[14px]">
              {search || selected.length ? "Nothing matches." : "No resources yet — tap + to save one."}
            </Text>
          ) : (
            <View className="flex-row gap-[11px]">
              <View className="flex-1">
                {colA.map((r) => (
                  <ResourceCard key={r.id} resource={r} tags={resolveTags(r)} onPress={() => openResource(r)} onLongPress={() => setMenuFor(r)} />
                ))}
              </View>
              <View className="flex-1">
                {colB.map((r) => (
                  <ResourceCard key={r.id} resource={r} tags={resolveTags(r)} onPress={() => openResource(r)} onLongPress={() => setMenuFor(r)} />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        accessibilityLabel="New resource"
        className="bg-accent rounded-fab absolute h-[54px] w-[54px] items-center justify-center"
        style={{ right: 20, bottom: 112, shadowColor: c.accent, shadowOpacity: 0.4, shadowRadius: 13, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}
      >
        <Plus size={22} color={c.onAccent} strokeWidth={2.2} />
      </Pressable>

      {/* New / edit resource sheet */}
      <NewResourceSheet visible={sheetOpen} resource={editing} tags={tags} onClose={() => setSheetOpen(false)} />

      {/* Long-press menu */}
      <Modal transparent visible={!!menuFor} animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable onPress={() => setMenuFor(null)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-10">
          <View className="border-line bg-elev rounded-card w-full overflow-hidden border">
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
                if (menuFor) deleteResource.mutate(menuFor.id);
                setMenuFor(null);
              }}
              className="px-4 py-3"
            >
              <Text className="text-high text-[14.5px]">Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* New tag modal */}
      <Modal transparent visible={newTagOpen} animationType="fade" onRequestClose={() => setNewTagOpen(false)}>
        <Pressable onPress={() => setNewTagOpen(false)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
          <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full border p-4">
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
