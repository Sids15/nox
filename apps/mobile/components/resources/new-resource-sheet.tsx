import { useCreateResource, useCreateTag, useThemeColors, useThemeVars, useUpdateResource } from "@nox/features";
import { resourceTypes, type Resource, type ResourceInput, type Tag } from "@nox/types";
import { domainFrom } from "@nox/utils";
import { Link2, Plus, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SegmentedControl } from "../tasks/segmented-control";
import { fetchUrlMeta } from "../../lib/url-meta";
import { nextTagColor, TAG_PALETTE } from "../../lib/tag-palette";

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const TYPE_OPTS = resourceTypes.map((t) => ({ value: t, label: cap(t) }));

function letterColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

export function NewResourceSheet({
  visible,
  resource,
  tags,
  onClose,
}: {
  visible: boolean;
  resource: Resource | null;
  tags: Tag[];
  onClose: () => void;
}) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const createTag = useCreateTag();

  const [type, setType] = useState<Resource["type"]>("link");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [fetched, setFetched] = useState(false);
  const titleTouched = useRef(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGen = useRef(0); // bumped to invalidate any in-flight URL fetch

  useEffect(() => {
    // Invalidate/cancel any pending or in-flight fetch from a previously-open resource.
    fetchGen.current++;
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    if (!visible) return;
    if (resource) {
      setType(resource.type);
      setUrl(resource.url ?? "");
      setBody(resource.body ?? "");
      setTitle(resource.title ?? "");
      setThumbnail(resource.thumbnail_url);
      setTagIds(resource.tag_ids);
      setFetched(!!resource.title);
    } else {
      setType("link");
      setUrl("");
      setBody("");
      setTitle("");
      setThumbnail(null);
      setTagIds([]);
      setFetched(false);
    }
    setTagQuery("");
    titleTouched.current = false;
  }, [visible, resource?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const domain = url.trim() ? domainFrom(url) : "";

  const onUrl = (u: string) => {
    setUrl(u);
    titleTouched.current = false;
    setFetched(false);
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    if (!u.trim()) return;
    const gen = ++fetchGen.current;
    fetchTimer.current = setTimeout(async () => {
      const meta = await fetchUrlMeta(u);
      if (gen !== fetchGen.current || !meta) return; // superseded (url changed / resource switched)
      if (meta.title && !titleTouched.current) setTitle(meta.title);
      if (meta.image) setThumbnail(meta.image);
      setFetched(true);
    }, 700);
  };

  const addTag = (id: string) => {
    setTagIds((s) => (s.includes(id) ? s : [...s, id]));
    setTagQuery("");
  };
  const createAndAdd = () => {
    const name = tagQuery.trim();
    if (!name) return;
    // Reuse an existing tag if the name already matches (avoids duplicates on keyboard-submit).
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const id = existing ? existing.id : createTag.create({ name, color: nextTagColor(tags.length) }).id;
    addTag(id);
  };
  const removeTag = (id: string) => setTagIds((s) => s.filter((x) => x !== id));

  const selectedTags = tagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as Tag[];
  const q = tagQuery.trim().toLowerCase();
  const exact = tags.some((t) => t.name.toLowerCase() === q);
  const suggestions = q ? tags.filter((t) => t.name.toLowerCase().includes(q) && !tagIds.includes(t.id)) : [];

  const save = () => {
    const input: ResourceInput = {
      type,
      url: type === "text" ? null : url.trim() || null,
      title: title.trim() || null,
      domain: type === "text" ? null : domain || null,
      thumbnail_url: thumbnail,
      duration: resource?.duration ?? null,
      body: type === "text" ? body.trim() || null : null,
      tag_ids: tagIds,
    };
    if (resource) updateResource.mutate({ id: resource.id, patch: input });
    else createResource.create(input);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[{ flex: 1 }, vars(themeVars)]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable className="flex-1 bg-black/55" onPress={onClose} />
        <View
          className="bg-sheet gap-4 rounded-t-[28px] px-5 pb-9 pt-2.5"
          style={{ shadowColor: "rgb(4,4,10)", shadowOpacity: 0.4, shadowRadius: 40, shadowOffset: { width: 0, height: -14 } }}
        >
          <View className="bg-ink-3 h-1 w-9 self-center rounded-full opacity-50" />
          <View className="flex-row items-center justify-between">
            <Text className="text-ink text-[19px] font-bold tracking-[-0.02em]">
              {resource ? "Edit resource" : "New resource"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text className="text-ink-3 text-[14px] font-semibold">Cancel</Text>
            </Pressable>
          </View>

          {/* Type */}
          <SegmentedControl value={type} onChange={setType} options={TYPE_OPTS} />

          {/* URL or body */}
          {type === "text" ? (
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              placeholder="Paste or write the snippet…"
              placeholderTextColor={c.ink3}
              className="bg-chip rounded-input text-ink min-h-[80px] px-3 py-3 text-[14px] leading-[21px]"
              style={{ textAlignVertical: "top" }}
            />
          ) : (
            <View className="bg-chip rounded-input h-11 flex-row items-center gap-[10px] px-[13px]">
              <Link2 size={15} color={c.ink3} strokeWidth={1.8} />
              <TextInput
                value={url}
                onChangeText={onUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="Paste a URL"
                placeholderTextColor={c.ink3}
                className="text-ink flex-1 font-mono text-[12.5px]"
                style={{ paddingVertical: 0 }}
              />
            </View>
          )}

          {/* Fetched preview */}
          {type !== "text" && !!domain && (
            <View className="border-line flex-row items-center gap-[11px] rounded-[14px] border px-3 py-[11px]">
              <View className="h-9 w-9 items-center justify-center rounded-[9px]" style={{ backgroundColor: `${letterColor(domain)}29` }}>
                <Text style={{ color: letterColor(domain) }} className="text-[13px] font-bold">{domain.charAt(0).toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <TextInput
                  value={title}
                  onChangeText={(t) => {
                    titleTouched.current = true;
                    setTitle(t);
                  }}
                  placeholder="Title"
                  placeholderTextColor={c.ink3}
                  className="text-ink text-[13.5px] font-semibold"
                  style={{ paddingVertical: 0 }}
                />
                <Text className="text-ink-3 mt-0.5 font-mono text-[10px]">
                  {fetched ? "fetched preview · " : ""}{domain}
                </Text>
              </View>
              <View className={`h-1.5 w-1.5 rounded-full ${fetched ? "bg-success" : "bg-ink-3"}`} />
            </View>
          )}

          {/* Tags */}
          <View className="gap-[9px]">
            <Text className="text-ink-3 font-mono text-[10px] font-semibold tracking-[0.14em]">TAGS</Text>
            <View className="flex-row flex-wrap items-center gap-[6px]">
              {selectedTags.map((t) => (
                <Pressable key={t.id} onPress={() => removeTag(t.id)} style={{ backgroundColor: t.color }} className="rounded-pill flex-row items-center gap-1.5 px-3 py-[7px]">
                  <Text className="text-[12px] font-semibold text-white">{t.name}</Text>
                  <X size={11} color="#fff" strokeWidth={2.5} style={{ opacity: 0.8 }} />
                </Pressable>
              ))}
              <TextInput
                value={tagQuery}
                onChangeText={setTagQuery}
                onSubmitEditing={createAndAdd}
                autoCapitalize="none"
                placeholder="add tag"
                placeholderTextColor={c.ink3}
                className="text-ink min-w-[70px] flex-1 text-[13px]"
                style={{ paddingVertical: 6 }}
              />
            </View>

            {!!q && (
              <View className="border-line bg-elev rounded-input overflow-hidden border">
                {!exact && (
                  <Pressable onPress={createAndAdd} className="border-line flex-row items-center gap-[10px] border-b px-[13px] py-3">
                    <View className="bg-accent/[0.15] h-6 w-6 items-center justify-center rounded-full">
                      <Plus size={12} color={c.accent} strokeWidth={2.4} />
                    </View>
                    <Text className="text-accent text-[13.5px] font-semibold">Create tag “{tagQuery.trim()}”</Text>
                  </Pressable>
                )}
                {suggestions.map((t, i) => (
                  <Pressable
                    key={t.id}
                    onPress={() => addTag(t.id)}
                    className={`flex-row items-center gap-[10px] px-[13px] py-3 ${i < suggestions.length - 1 ? "border-line border-b" : ""}`}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: t.color, marginHorizontal: 8 }} />
                    <Text className="text-ink-2 flex-1 text-[13.5px]">{t.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Save */}
          <Pressable
            onPress={save}
            className="bg-accent items-center rounded-[14px] py-[15px]"
            style={{ shadowColor: c.accent, shadowOpacity: 0.35, shadowRadius: 26, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}
          >
            <Text className="text-on-accent text-[15px] font-bold">Save resource</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
