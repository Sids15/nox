import {
  useCreateTemplate,
  useDeleteNote,
  useFolders,
  useNotes,
  useSetNotePinned,
  useThemeColors,
  useUpdateNote,
} from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { relativeFromNow } from "@nox/utils";
import { ChevronDown, ChevronLeft, Folder, FolderInput, Globe, Inbox, LayoutTemplate, Pin, PinOff, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { BlockList } from "../blocks/block-list";
import { BlockToolbar } from "../blocks/block-toolbar";
import { useBlockEditor } from "../blocks/use-block-editor";
import { useMediaBlocks } from "../blocks/use-media-blocks";
import { EditorTopBar } from "../editor-top-bar";
import { DocAssist } from "../ai/doc-assist";
import { Backlinks } from "../brain/backlinks";
import { PageFields } from "../brain/page-fields";
import { DetailsToggle, MetaSummary, TemplateMenu } from "../brain/page-meta";
import { fromTemplate, isBlankPage, toTemplate } from "../brain/templates";
import { Alert } from "../../lib/alert";
import { MenuLabel, MenuRow } from "../menu";
import { ShareSheet } from "../share-sheet";
import { Popover } from "../popover";
import { TagEditor, useKnownTags } from "../tag-editor";
import { confirmDelete } from "../../lib/confirm";
import { useIsDesktop } from "../../lib/use-responsive";
import { noteTitle } from "./note-utils";

/**
 * The note editor body — driven by an `id` (not the route params) so it works both as the standalone
 * `/note/[id]` route and as the editor pane in the desktop Notes 3-pane. `onClose` is what the back
 * button / post-delete flow calls (router.back on the route, clear the selection in the split).
 * Renders no SafeAreaView / Sidebar — the caller owns the frame.
 */
export function NoteEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useThemeColors();
  const [sharing, setSharing] = useState(false);
  const isDesktop = useIsDesktop();

  const { data: notes = [] } = useNotes();
  const { data: folders = [] } = useFolders();
  const note = useMemo(() => notes.find((n) => n.id === id), [notes, id]);

  const updateNote = useUpdateNote();
  const setPinned = useSetNotePinned();
  const del = useDeleteNote();
  const createTemplate = useCreateTemplate();

  const [title, setTitle] = useState("");
  const [moving, setMoving] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  // Every property lives behind "Details"; what's set shows as chips above it.
  const [details, setDetails] = useState(false);
  const folderRef = useRef<View>(null);
  const knownTags = useKnownTags();
  const closeMenu = useRef<(() => void) | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (note) setTitle(note.title ?? "");
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTitle = (t: string) => {
    setTitle(t);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      if (id) updateNote.mutate({ id, patch: { title: t.trim() || null } });
    }, 600);
  };
  const saveContent = (content: ContentBlock[]) => {
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => {
      if (id) updateNote.mutate({ id, patch: { content } });
    }, 600);
  };
  const editor = useBlockEditor(note?.id ?? "", note?.content ?? [], saveContent);
  const [linkSignal, setLinkSignal] = useState(0);
  const media = useMediaBlocks(note?.id ?? "", editor);

  if (!note) {
    return (
      <View className="flex-1">
        <View className="px-screen pt-2">
          <Pressable onPress={onClose} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink-2 mt-8 text-[15px]">Note not found.</Text>
        </View>
      </View>
    );
  }

  const folderName = folders.find((f) => f.id === note.folder_id)?.name;

  return (
    <View className="flex-1">
      <View style={isDesktop ? { maxWidth: 680, width: "100%", alignSelf: "center", paddingTop: 20 } : undefined}>
        <EditorTopBar
          backLabel="Notes"
          onBack={onClose}
          context={folderName}
          closeRef={closeMenu}
          onMenuClose={() => setMoving(false)}
          menuView={
            moving ? (
              <View className="p-1.5">
                <MenuLabel>Move to</MenuLabel>
                {[{ id: null as string | null, name: "No folder" }, ...folders].map((row) => (
                  <MenuRow
                    key={row.id ?? "none"}
                    label={row.name}
                    selected={note.folder_id === row.id}
                    icon={row.id === null ? <Inbox size={15} color={c.ink2} strokeWidth={2} /> : <Folder size={15} color={c.ink2} strokeWidth={2} />}
                    onPress={() => {
                      if (note.folder_id !== row.id) updateNote.mutate({ id: note.id, patch: { folder_id: row.id } });
                      closeMenu.current?.();
                    }}
                  />
                ))}
              </View>
            ) : undefined
          }
          menu={[
            {
              label: note.is_pinned ? "Unpin" : "Pin to top",
              icon: note.is_pinned ? <PinOff size={15} color={c.ink2} strokeWidth={2} /> : <Pin size={15} color={c.ink2} strokeWidth={2} />,
              onPress: () => setPinned.mutate({ id: note.id, isPinned: !note.is_pinned }),
            },
            {
              label: "Move to folder…",
              keepOpen: true,
              icon: <FolderInput size={15} color={c.ink2} strokeWidth={2} />,
              onPress: () => setMoving(true),
            },
            {
              label: "Save as template",
              icon: <LayoutTemplate size={15} color={c.ink2} strokeWidth={2} />,
              onPress: () => {
                const name = title.trim() || noteTitle(note);
                createTemplate.create(toTemplate(name, "note", null, editor.blocks, note.properties));
                Alert.alert("Template saved", `“${name}” is now in your templates. It shows on every new blank page.`);
              },
            },
            {
              label: "Share link…",
              icon: <Globe size={15} color={c.ink2} strokeWidth={2} />,
              onPress: () => setSharing(true),
            },
            {
              label: "Delete note",
              danger: true,
              divided: true,
              icon: <Trash2 size={15} color={c.high} strokeWidth={2} />,
              onPress: () =>
                confirmDelete({
                  title: "Delete note?",
                  message: `“${noteTitle(note)}” will be deleted on all your devices.`,
                  onConfirm: () => {
                    del.mutate(note.id);
                    onClose();
                  },
                }),
            },
          ]}
        />
        <ShareSheet kind="note" targetId={note.id} title={title.trim() || noteTitle(note)} visible={sharing} onClose={() => setSharing(false)} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48, maxWidth: 680, width: "100%", alignSelf: "center" }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Title + save state */}
        <View className="px-[22px] pt-5">
          <AutoGrowInput
            value={title}
            onChangeText={onTitle}
            placeholder="Untitled note"
            placeholderTextColor={c.ink3}
            minHeight={30}
            className="text-ink font-serif text-[24px] font-bold leading-[30px] tracking-[-0.01em]"
          />
          <Text className="text-ink-3 mt-1.5 text-[12px]">Saved · edited {relativeFromNow(note.updated_at)}</Text>

          <MetaSummary
            folderName={folderName}
            spaceId={note.space_id}
            tags={note.tags}
            properties={note.properties}
            onOpen={() => setDetails(true)}
          />
          <DocAssist
            docId={note.id}
            editor={editor}
            title={title}
            onTitle={onTitle}
            tags={note.tags}
            onTags={(tags) => updateNote.mutate({ id: note.id, patch: { tags } })}
            knownTags={knownTags}
            leading={
              <>
                <DetailsToggle open={details} onPress={() => setDetails((v) => !v)} />
                {isBlankPage(title, editor.blocks, note.properties) ? (
                  <TemplateMenu
                    kind="note"
                    onPick={(t) => {
                      const made = fromTemplate(t);
                      editor.replaceAll(made.content);
                      if (made.title) onTitle(made.title);
                      updateNote.mutate({ id: note.id, patch: { properties: made.properties } });
                    }}
                  />
                ) : null}
              </>
            }
            drawer={
              details ? (
                /* Every property of the note: where it lives, how it's tagged, its fields. */
                <View className="border-line rounded-[12px] border px-3 py-1.5">
                  <View className="min-h-[36px] flex-row items-center">
                    <Text className="text-ink-3 w-[72px] text-[14px]">Folder</Text>
                    <View ref={folderRef} collapsable={false}>
                      <Pressable
                        onPress={() => setFolderOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Folder: ${folderName ?? "None"}`}
                        className={`-ml-2 h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2 ${folderOpen ? "bg-chip" : "hover:bg-chip"}`}
                      >
                        {note.folder_id ? <Folder size={14} color={c.ink2} strokeWidth={2} /> : <Inbox size={14} color={c.ink3} strokeWidth={2} />}
                        <Text className={`text-[14px] ${note.folder_id ? "text-ink font-medium" : "text-ink-3"}`}>{folderName ?? "No folder"}</Text>
                        <ChevronDown size={13} color={c.ink3} strokeWidth={2.2} />
                      </Pressable>
                    </View>
                  </View>
                  <View className="flex-row py-1">
                    <Text className="text-ink-3 w-[72px] pt-1 text-[14px]">Tags</Text>
                    <View className="min-w-0 flex-1">
                      <TagEditor tags={note.tags} onChange={(tags) => updateNote.mutate({ id: note.id, patch: { tags } })} known={knownTags} />
                    </View>
                  </View>
                  <PageFields
                    spaceId={note.space_id}
                    properties={note.properties}
                    onPatch={(p) => updateNote.mutate({ id: note.id, patch: p })}
                  />
                </View>
              ) : null
            }
          />
          <Popover anchorRef={folderRef} open={folderOpen} onClose={() => setFolderOpen(false)} width={230} accessibilityLabel="Folder">
            <View className="p-1.5">
              {[{ id: null as string | null, name: "No folder" }, ...folders].map((row) => (
                <MenuRow
                  key={row.id ?? "none"}
                  label={row.name}
                  selected={note.folder_id === row.id}
                  icon={row.id === null ? <Inbox size={15} color={c.ink2} strokeWidth={2} /> : <Folder size={15} color={c.ink2} strokeWidth={2} />}
                  onPress={() => {
                    setFolderOpen(false);
                    if (note.folder_id !== row.id) updateNote.mutate({ id: note.id, patch: { folder_id: row.id } });
                  }}
                />
              ))}
            </View>
          </Popover>
        </View>

        {/* Blocks */}
        <View className="border-line mx-[22px] mt-3 border-t" />
        <View className="px-[22px] pt-4">
          <BlockList editor={editor} minHeight={320} self={{ kind: "note", id: note.id }}
            onImage={media.addImage}
            onWebLink={() => setLinkSignal((n) => n + 1)} spaceId={note.space_id} />
          <Backlinks target={{ kind: "note", id: note.id }} content={editor.blocks} />
        </View>
      </ScrollView>

      <BlockToolbar
        onAddHeading={editor.addHeading}
        onAddParagraph={editor.addParagraph}
        onAddLink={editor.addLink}
        onAddImage={media.addImage}
        onRecordComplete={media.addAudio}
        onDictate={editor.insertText}
        onLinkPage={editor.startLink}
        openLinkSignal={linkSignal}
      />

    </View>
  );
}
