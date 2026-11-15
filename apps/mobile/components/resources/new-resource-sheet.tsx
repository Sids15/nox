import { newId } from "@nox/db";
import { useCreateResource, useCreateTag, useSessionStore, useThemeColors, useThemeVars, useUpdateResource } from "@nox/features";
import { resourceTypes, type Resource, type ResourceInput, type Tag } from "@nox/types";
import { capitalize as cap, domainFrom } from "@nox/utils";
import { Check, Image as ImageIcon, ImagePlus, Link2, PlayCircle, Plus, Quote, X } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Alert } from "../../lib/alert";
import { pressScale } from "../menu";
import { pickImage } from "../../lib/media";
import { uploadToBucket, useSignedUrl } from "../../lib/storage";
import { fetchUrlMeta, videoThumbnail } from "../../lib/url-meta";
import { nextTagColor, TAG_PALETTE } from "../../lib/tag-palette";
import { useIsDesktop } from "../../lib/use-responsive";

// Keep in sync with the `images` bucket policy (migration 0006).
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Preview inside the sheet: shows the just-picked local file, or signs a stored Storage path. */
function ImagePreview({ localUri, path }: { localUri: string | null; path: string | null }) {
  const isRemote = path ? /^(https?:|data:)/.test(path) : false;
  const { data: signed } = useSignedUrl("images", localUri || isRemote ? null : path);
  const uri = localUri ?? (isRemote ? path : signed ?? null);
  if (!uri) return <View className="bg-chip h-[150px]" />;
  return <Image source={{ uri }} style={{ width: "100%", height: 150 }} resizeMode="cover" />;
}

const TYPE_ICON = { link: Link2, image: ImageIcon, video: PlayCircle, text: Quote } as const;
const TYPE_TABS = resourceTypes.map((t) => ({ value: t, label: t === "text" ? "Snippet" : cap(t), Icon: TYPE_ICON[t] }));

/** A bordered input row on the sheet's paper. */
function Field({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <View className="border-line bg-surface h-[44px] flex-row items-center gap-2.5 rounded-[11px] border px-3">
      {icon}
      {children}
    </View>
  );
}

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
  const isDesktop = useIsDesktop();
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const createTag = useCreateTag();

  const [type, setType] = useState<Resource["type"]>("link");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [localImage, setLocalImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
    setLocalImage(null);
    setUploading(false);
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
    // A YouTube link resolves a reliable thumbnail immediately (og:image fetch is best-effort and
    // often blocked for video hosts).
    const vt = videoThumbnail(u);
    if (vt) {
      setThumbnail(vt);
      // A video link pasted under Link is a video: switch so it saves and plays as one.
      setType((t) => (t === "link" ? "video" : t));
    }
    fetchTimer.current = setTimeout(async () => {
      const meta = await fetchUrlMeta(u);
      if (gen !== fetchGen.current || !meta) return; // superseded (url changed / resource switched)
      if (meta.title && !titleTouched.current) setTitle(meta.title);
      if (meta.image) setThumbnail(meta.image);
      else if (vt) setThumbnail(vt);
      setFetched(true);
    }, 700);
  };

  // Pick a photo from the library and upload it to the private images bucket; the stored path is
  // signed on read by the resource card.
  const pickAndUpload = async () => {
    const picked = await pickImage();
    if (!picked || !userId) return;
    const ext = IMAGE_MIME_EXT[picked.mimeType];
    if (!ext) {
      Alert.alert("Unsupported image", "Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (picked.fileSize && picked.fileSize > IMAGE_MAX_BYTES) {
      Alert.alert("Image too large", "Please choose an image under 10 MB.");
      return;
    }
    setLocalImage(picked.uri);
    setUploading(true);
    const path = await uploadToBucket("images", `${userId}/resources/${newId()}.${ext}`, picked.uri, picked.mimeType);
    setUploading(false);
    if (path) setThumbnail(path);
    else Alert.alert("Upload failed", "Could not upload the image. Please try again.");
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

  const canSave =
    !uploading &&
    (type === "text" ? !!body.trim() : type === "image" ? !!thumbnail : !!url.trim());

  const save = () => {
    if (!canSave) return;
    const isMedia = type === "text" || type === "image";
    const input: ResourceInput = {
      type,
      url: isMedia ? null : url.trim() || null,
      title: title.trim() || null,
      domain: isMedia ? null : domain || null,
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
    // Mobile: a bottom sheet. Desktop: a centered dialog — a window-wide sheet is a phone gesture
    // that reads broken on a 1900px window.
    <Modal transparent visible={visible} animationType={isDesktop ? "fade" : "slide"} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[{ flex: 1 }, isDesktop ? { justifyContent: "center", alignItems: "center", padding: 24 } : null, vars(themeVars)]}
        // Android too: a Modal window doesn't resize for the keyboard by itself, so the sheet would
        // sit under it.
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* The backdrop always fills the whole screen. As flex-1 it stopped at the top of the
            keyboard avoider's padding, so while typing on iOS the strip between the sheet and the
            keyboard showed the screen behind, undimmed. A spacer now does the pushing. */}
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} accessibilityLabel="Close" />
        {!isDesktop && <View className="flex-1" pointerEvents="none" />}
        <View
          className={
            isDesktop
              ? "bg-sheet border-line w-full gap-4 rounded-[18px] border px-6 pb-5 pt-5"
              : "bg-sheet rounded-t-[24px] pt-2.5"
          }
          style={
            isDesktop
              ? { maxWidth: 540, shadowColor: "#1B2131", shadowOpacity: 0.22, shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 20 }
              : // Capped below the screen height, so with the keyboard up the form scrolls instead of
                // its top being cut off.
                { maxHeight: win.height * 0.9, shadowColor: "#1B2131", shadowOpacity: 0.2, shadowRadius: 30, shadowOffset: { width: 0, height: -10 } }
          }
        >
          {!isDesktop && <View className="bg-ink-3 mb-2 h-1 w-9 self-center rounded-full opacity-40" />}

          {/* On phones everything but the Save button scrolls; Save stays pinned below. */}
          <ScrollView
            scrollEnabled={!isDesktop}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ gap: 16, ...(isDesktop ? null : { paddingHorizontal: 20, paddingBottom: 4 }) }}
          >
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <Text className="text-ink font-serif text-[22px] font-bold">{resource ? "Edit resource" : "Save something"}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="hover:bg-chip -mr-1.5 h-8 w-8 items-center justify-center rounded-[9px]"
            >
              <X size={18} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* Type — icon tabs */}
          <View className="border-line flex-row gap-1 border-b" accessibilityRole="tablist">
            {TYPE_TABS.map(({ value, label, Icon }) => {
              const on = type === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setType(value)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  className="-mb-px flex-row items-center gap-1.5 px-2.5 pb-2.5 pt-1"
                  style={{ borderBottomWidth: 2, borderBottomColor: on ? c.accent : "transparent" }}
                >
                  <Icon size={15} color={on ? c.ink : c.ink3} strokeWidth={2} />
                  <Text className={`text-[13.5px] font-semibold ${on ? "text-ink" : "text-ink-3"}`}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* The thing itself. A steady height on phones so switching tabs doesn't make the sheet jump. */}
          <View style={isDesktop ? undefined : { minHeight: 132 }}>
          {type === "text" ? (
            <View className="gap-2.5">
              <View className="border-line bg-surface flex-row rounded-[12px] border px-3.5 py-3">
                <View className="bg-accent mr-3 w-[3px] rounded-full" />
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  multiline
                  autoFocus={!resource}
                  placeholder="Paste a quote, a command, a line worth keeping…"
                  placeholderTextColor={c.ink3}
                  accessibilityLabel="Snippet"
                  className="text-ink min-h-[96px] flex-1 font-serif text-[16px] leading-[24px]"
                  style={{ textAlignVertical: "top", paddingVertical: 0, outlineWidth: 0 } as object}
                />
              </View>
              <Field icon={<Quote size={14} color={c.ink3} strokeWidth={2} />}>
                <TextInput
                  value={title}
                  onChangeText={(t) => {
                    titleTouched.current = true;
                    setTitle(t);
                  }}
                  placeholder="Source (optional) — e.g. Dieter Rams"
                  placeholderTextColor={c.ink3}
                  accessibilityLabel="Source"
                  className="text-ink flex-1 text-[14px]"
                  style={{ paddingVertical: 0, outlineWidth: 0 } as object}
                />
              </Field>
            </View>
          ) : type === "image" ? (
            <View className="gap-2.5">
              <Pressable
                onPress={pickAndUpload}
                accessibilityRole="button"
                accessibilityLabel={localImage || thumbnail ? "Change picture" : "Choose a picture"}
                className="border-line bg-surface hover:bg-chip overflow-hidden rounded-[12px] border"
                style={localImage || thumbnail ? undefined : { borderStyle: "dashed" }}
              >
                {localImage || thumbnail ? (
                  <View>
                    <ImagePreview localUri={localImage} path={thumbnail} />
                    {uploading && (
                      <View className="absolute inset-0 items-center justify-center bg-black/40">
                        <ActivityIndicator color="#fff" />
                      </View>
                    )}
                    <View className="absolute bottom-2 right-2 rounded-[8px] bg-black/60 px-2.5 py-1">
                      <Text className="text-[12px] font-semibold text-white">Change</Text>
                    </View>
                  </View>
                ) : (
                  <View className="h-[150px] items-center justify-center gap-1.5">
                    <ImagePlus size={22} color={c.ink2} strokeWidth={1.8} />
                    <Text className="text-ink text-[14px] font-semibold">Choose a picture</Text>
                    <Text className="text-ink-3 text-[12.5px]">JPEG, PNG or WebP, up to 10 MB</Text>
                  </View>
                )}
              </Pressable>
              <Field>
                <TextInput
                  value={title}
                  onChangeText={(t) => {
                    titleTouched.current = true;
                    setTitle(t);
                  }}
                  placeholder="Caption (optional)"
                  placeholderTextColor={c.ink3}
                  accessibilityLabel="Caption"
                  className="text-ink flex-1 text-[14px]"
                  style={{ paddingVertical: 0, outlineWidth: 0 } as object}
                />
              </Field>
            </View>
          ) : (
            <View className="gap-2.5">
              <Field icon={<Link2 size={15} color={c.ink3} strokeWidth={2} />}>
                <TextInput
                  value={url}
                  onChangeText={onUrl}
                  autoFocus={!resource}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder={type === "video" ? "Paste a YouTube or Vimeo link" : "Paste a link"}
                  placeholderTextColor={c.ink3}
                  accessibilityLabel="URL"
                  onSubmitEditing={() => canSave && save()}
                  className="text-ink flex-1 text-[14px]"
                  style={{ paddingVertical: 0, outlineWidth: 0 } as object}
                />
                {!!url && (
                  <Pressable onPress={() => onUrl("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear link">
                    <X size={14} color={c.ink3} strokeWidth={2.2} />
                  </Pressable>
                )}
              </Field>

              {/* Before a link is pasted: where its preview will appear, and what to paste. */}
              {!domain && (
                <View className="border-line items-center justify-center rounded-[12px] border border-dashed px-4" style={{ minHeight: 76 }}>
                  <Text className="text-ink-3 text-center text-[13px] leading-[19px]">
                    {type === "video"
                      ? "Paste a YouTube or Vimeo link. Nox shows its thumbnail and plays it here."
                      : "Paste any link: an article, a repo, a site. Nox fetches its title and preview."}
                  </Text>
                </View>
              )}

              {/* Preview: what the card will look like, with an editable title. */}
              {!!domain && (
                <View className="border-line bg-surface flex-row overflow-hidden rounded-[12px] border">
                  {thumbnail && /^https?:/.test(thumbnail) ? (
                    <Image source={{ uri: thumbnail }} style={{ width: 96, alignSelf: "stretch", minHeight: 72 }} resizeMode="cover" />
                  ) : (
                    <View className="w-[64px] items-center justify-center" style={{ backgroundColor: `${letterColor(domain)}1f` }}>
                      <Text style={{ color: letterColor(domain) }} className="text-[18px] font-bold">
                        {domain.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1 justify-center px-3 py-2.5">
                    <TextInput
                      value={title}
                      onChangeText={(t) => {
                        titleTouched.current = true;
                        setTitle(t);
                      }}
                      placeholder={fetched ? "Add a title" : "Fetching the title…"}
                      placeholderTextColor={c.ink3}
                      accessibilityLabel="Title"
                      className="text-ink text-[14.5px] font-semibold"
                      style={{ paddingVertical: 0, outlineWidth: 0 } as object}
                    />
                    <View className="mt-1 flex-row items-center gap-1.5">
                      {!fetched && <ActivityIndicator size="small" color={c.ink3} style={{ transform: [{ scale: 0.6 }], width: 12, height: 12 }} />}
                      <Text className="text-ink-3 text-[12px]">{domain}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          </View>

          {/* Tags: every tag you have, tap to add or remove; type to make a new one. */}
          <View className="gap-2">
            <Text className="text-ink-2 text-[13px] font-semibold">Tags</Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => (on ? removeTag(t.id) : addTag(t.id))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={{ backgroundColor: on ? t.color : `${t.color}1f` }}
                    className="rounded-pill flex-row items-center gap-1 px-2.5 py-[5px]"
                  >
                    {on && <Check size={11} color="#fff" strokeWidth={3} />}
                    <Text style={{ color: on ? "#fff" : t.color }} className="text-[12.5px] font-semibold">
                      {t.name}
                    </Text>
                  </Pressable>
                );
              })}
              <View className="border-line rounded-pill flex-row items-center gap-1 border border-dashed px-2.5" style={{ height: 27 }}>
                <Plus size={12} color={c.ink3} strokeWidth={2.2} />
                <TextInput
                  value={tagQuery}
                  onChangeText={setTagQuery}
                  onSubmitEditing={createAndAdd}
                  submitBehavior="submit"
                  autoCapitalize="none"
                  placeholder="New tag"
                  placeholderTextColor={c.ink3}
                  accessibilityLabel="New tag"
                  className="text-ink text-[12.5px]"
                  style={{ paddingVertical: 0, outlineWidth: 0, width: Math.max(64, Math.min(160, tagQuery.length * 8 + 16)) } as object}
                />
              </View>
            </View>
            {!!q && !exact && (
              <Pressable onPress={createAndAdd} accessibilityRole="button" className="hover:bg-chip flex-row items-center gap-2 self-start rounded-[8px] px-2 py-1.5">
                <Plus size={13} color={c.accent} strokeWidth={2.4} />
                <Text className="text-accent text-[13px] font-semibold">Create tag “{tagQuery.trim()}”</Text>
              </Pressable>
            )}
          </View>

          </ScrollView>

          {/* Footer */}
          <View
            className={`flex-row items-center gap-2 ${isDesktop ? "justify-end pt-4" : "border-line border-t px-5 pt-3"}`}
            style={isDesktop ? undefined : { paddingBottom: Math.max(insets.bottom, 12) + 4 }}
          >
            {isDesktop && (
              <Pressable onPress={onClose} accessibilityRole="button" style={pressScale} className="hover:bg-chip h-10 justify-center rounded-[10px] px-4">
                <Text className="text-ink-2 text-[14px] font-semibold">Cancel</Text>
              </Pressable>
            )}
            <Pressable
              onPress={save}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              style={pressScale}
              className={`h-10 items-center justify-center rounded-[10px] px-5 ${isDesktop ? "" : "h-[48px] flex-1 rounded-[12px]"} ${canSave ? "bg-accent hover:opacity-90" : "bg-chip"}`}
            >
              <Text className={`text-[14.5px] font-semibold ${canSave ? "text-on-accent" : "text-ink-3"}`}>
                {uploading
                  ? "Uploading…"
                  : canSave
                    ? resource
                      ? "Save changes"
                      : "Save"
                    : type === "text"
                      ? "Write a snippet to save"
                      : type === "image"
                        ? "Choose a picture to save"
                        : "Paste a link to save"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
