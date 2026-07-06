import {
  useDeleteNote,
  useFolders,
  useNotes,
  useSetNotePinned,
  useThemeColors,
  useThemeVars,
  useUpdateNote,
} from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { relativeFromNow } from "@nox/utils";
import { Check, ChevronLeft, Folder, Inbox, MoreHorizontal } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { BlockList } from "../blocks/block-list";
import { BlockToolbar } from "../blocks/block-toolbar";
import { useBlockEditor } from "../blocks/use-block-editor";
import { useMediaBlocks } from "../blocks/use-media-blocks";
import { OverflowMenu } from "../overflow-menu";
import { useIsDesktop } from "../../lib/use-responsive";

/**
 * The note editor body — driven by an `id` (not the route params) so it works both as the standalone
 * `/note/[id]` route and as the editor pane in the desktop Notes 3-pane. `onClose` is what the back
 * button / post-delete flow calls (router.back on the route, clear the selection in the split).
 * Renders no SafeAreaView / Sidebar — the caller owns the frame.
 */
export function NoteEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const isDesktop = useIsDesktop();

  const { data: notes = [] } = useNotes();
  const { data: folders = [] } = useFolders();
  const note = useMemo(() => notes.find((n) => n.id === id), [notes, id]);

  const updateNote = useUpdateNote();
  const setPinned = useSetNotePinned();
  const del = useDeleteNote();

  const [title, setTitle] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
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
      {/* Nav */}
      <View className="px-screen flex-row items-center justify-between pt-2" style={isDesktop ? { maxWidth: 680, width: "100%", alignSelf: "center", paddingTop: 20 } : undefined}>
        <View className="flex-row items-center gap-2.5">
          <Pressable onPress={onClose} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink-3 font-mono text-[11px]">{folderName ?? "Notes"}</Text>
        </View>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
          <MoreHorizontal size={20} color={c.ink2} strokeWidth={1.7} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, maxWidth: 680, width: "100%", alignSelf: "center" }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Title + save state */}
        <View className="px-[22px] pt-5">
          <AutoGrowInput
            value={title}
            onChangeText={onTitle}
            placeholder="Title"
            placeholderTextColor={c.ink3}
            minHeight={30}
            className="text-ink text-[24px] font-bold leading-[30px] tracking-[-0.02em]"
          />
          <View className="mt-1.5 flex-row items-center gap-[7px]">
            <View className="bg-success h-1.5 w-1.5 rounded-full" />
            <Text className="text-ink-3 font-mono text-[10.5px]">
              auto-saved · edited {relativeFromNow(note.updated_at)}
            </Text>
          </View>
        </View>

        {/* Blocks */}
        <View className="px-[22px] pt-4">
          <BlockList blocks={editor.blocks} setText={editor.setText} removeBlock={editor.removeBlock} />
        </View>
      </ScrollView>

      <BlockToolbar
        onAddHeading={editor.addHeading}
        onAddParagraph={editor.addParagraph}
        onAddLink={editor.addLink}
        onAddImage={media.addImage}
        onRecordComplete={media.addAudio}
      />

      {/* Overflow menu */}
      <OverflowMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            label: note.is_pinned ? "Unpin" : "Pin",
            onPress: () => setPinned.mutate({ id: note.id, isPinned: !note.is_pinned }),
          },
          { label: "Move to folder", onPress: () => setMoveOpen(true) },
          {
            label: "Delete note",
            destructive: true,
            onPress: () => {
              del.mutate(note.id);
              onClose();
            },
          },
        ]}
      />

      {/* Move-to-folder */}
      <Modal transparent visible={moveOpen} animationType="fade" onRequestClose={() => setMoveOpen(false)}>
        <Pressable onPress={() => setMoveOpen(false)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-6">
          <Pressable
            onPress={() => {}}
            className="border-line bg-elev rounded-card max-h-[70%] w-full max-w-[420px] overflow-hidden border"
            style={{ shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 14 }}
          >
            <Text className="text-ink border-line border-b px-[18px] py-[14px] text-[15px] font-semibold">
              Move to folder
            </Text>
            <ScrollView>
              {(() => {
                const rows = [{ id: null as string | null, name: "No folder" }, ...folders];
                return rows.map((row, i) => {
                  const selected = note.folder_id === row.id;
                  return (
                    <View key={row.id ?? "none"}>
                      {i > 0 && <View className="bg-line ml-[52px] h-px" />}
                      <Pressable
                        onPress={() => {
                          updateNote.mutate({ id: note.id, patch: { folder_id: row.id } });
                          setMoveOpen(false);
                        }}
                        className="flex-row items-center gap-3 px-[18px] py-[13px]"
                      >
                        {row.id === null ? (
                          <Inbox size={18} color={selected ? c.accent : c.ink2} strokeWidth={1.8} />
                        ) : (
                          <Folder size={18} color={selected ? c.accent : c.ink2} strokeWidth={1.8} />
                        )}
                        <Text className={`flex-1 text-[14.5px] ${selected ? "text-accent font-semibold" : "text-ink"}`}>
                          {row.name}
                        </Text>
                        {selected && <Check size={16} color={c.accent} strokeWidth={2.5} />}
                      </Pressable>
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
