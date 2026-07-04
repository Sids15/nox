import {
  useDeleteNote,
  useFolders,
  useNotes,
  useSetNotePinned,
  useThemeColors,
  useThemeVars,
  useUpdateNote,
} from "@nox/features";
import type { NoteBlock } from "@nox/types";
import { relativeFromNow } from "@nox/utils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Heading, Image as ImageIcon, Mic, MoreHorizontal, PenTool, Pilcrow, Play } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const fmtDur = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Trim empty text blocks for persistence; always keep at least one paragraph. */
function cleanBlocks(blocks: NoteBlock[]): NoteBlock[] {
  const kept = blocks.filter((b) => !("text" in b) || b.text.trim() !== "");
  return kept.length ? kept : [{ type: "paragraph", text: "" }];
}

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const themeVars = useThemeVars();

  const { data: notes = [] } = useNotes();
  const { data: folders = [] } = useFolders();
  const note = useMemo(() => notes.find((n) => n.id === id), [notes, id]);

  const updateNote = useUpdateNote();
  const setPinned = useSetNotePinned();
  const del = useDeleteNote();

  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<NoteBlock[]>([{ type: "paragraph", text: "" }]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed once per note.
  useEffect(() => {
    if (note) {
      setTitle(note.title ?? "");
      setBlocks(note.content.length ? note.content : [{ type: "paragraph", text: "" }]);
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = (nextTitle: string, nextBlocks: NoteBlock[]) => {
    if (!id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateNote.mutate({
        id,
        patch: { title: nextTitle.trim() || null, content: cleanBlocks(nextBlocks) },
      });
    }, 600);
  };

  const onTitle = (t: string) => {
    setTitle(t);
    scheduleSave(t, blocks);
  };
  const onBlock = (i: number, text: string) => {
    const next = blocks.map((b, j) => (j === i && "text" in b ? { ...b, text } : b));
    setBlocks(next);
    scheduleSave(title, next);
  };
  const addBlock = (type: "paragraph" | "heading") => {
    const next: NoteBlock[] =
      type === "heading"
        ? [...blocks, { type: "heading", level: 2, text: "" }]
        : [...blocks, { type: "paragraph", text: "" }];
    setBlocks(next);
    scheduleSave(title, next);
  };

  const goBack = () => router.back();

  if (!note) {
    return (
      <SafeAreaView className="bg-bg flex-1">
        <View className="px-screen pt-2">
          <Pressable onPress={goBack} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink-2 mt-8 text-[15px]">Note not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const folderName = folders.find((f) => f.id === note.folder_id)?.name;

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      {/* Nav */}
      <View className="px-screen flex-row items-center justify-between pt-2">
        <View className="flex-row items-center gap-2.5">
          <Pressable onPress={goBack} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink-3 font-mono text-[11px]">{folderName ?? "Notes"}</Text>
        </View>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
          <MoreHorizontal size={20} color={c.ink2} strokeWidth={1.7} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title + save state */}
        <View className="px-[22px] pt-5">
          <TextInput
            value={title}
            onChangeText={onTitle}
            multiline
            placeholder="Title"
            placeholderTextColor={c.ink3}
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
        <View className="gap-3 px-[22px] pt-4">
          {blocks.map((block, i) => {
            if (block.type === "heading") {
              return (
                <TextInput
                  key={i}
                  value={block.text}
                  onChangeText={(t) => onBlock(i, t)}
                  multiline
                  placeholder="Heading"
                  placeholderTextColor={c.ink3}
                  className="text-ink text-[17px] font-bold tracking-[-0.01em]"
                />
              );
            }
            if (block.type === "paragraph") {
              return (
                <TextInput
                  key={i}
                  value={block.text}
                  onChangeText={(t) => onBlock(i, t)}
                  multiline
                  placeholder={i === 0 ? "Start writing…" : ""}
                  placeholderTextColor={c.ink3}
                  className="text-ink text-[15px] leading-[25px]"
                  style={{ textAlignVertical: "top" }}
                />
              );
            }
            if (block.type === "audio") {
              return (
                <View key={i} className="border-line bg-surface rounded-card flex-row items-center gap-3 border p-[13px]">
                  <View className="bg-accent h-[38px] w-[38px] items-center justify-center rounded-full">
                    <Play size={13} color={c.onAccent} fill={c.onAccent} />
                  </View>
                  <View className="flex-1 flex-row items-end gap-[3px]" style={{ height: 20 }}>
                    {[8, 14, 19, 11, 16, 9, 13].map((h, k) => (
                      <View key={k} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: c.ink3 }} />
                    ))}
                  </View>
                  <Text className="text-ink-2 font-mono text-[11px]">{fmtDur(block.durationMs)}</Text>
                </View>
              );
            }
            // sketch
            return (
              <View key={i} className="border-line h-[132px] items-center justify-center rounded-card border border-dashed">
                <Text className="text-ink-3 font-mono text-[10.5px]">sketch · png</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Formatting toolbar */}
      <View
        className="border-line bg-tabbar absolute h-[56px] flex-row items-center justify-around rounded-[28px] border px-2"
        style={{ left: 20, right: 20, bottom: 24, shadowColor: "rgb(6,6,14)", shadowOpacity: 0.25, shadowRadius: 22, shadowOffset: { width: 0, height: 18 }, elevation: 12 }}
      >
        <Pressable onPress={() => addBlock("heading")} hitSlop={6} className="px-2">
          <Heading size={19} color={c.ink2} strokeWidth={1.9} />
        </Pressable>
        <Pressable onPress={() => addBlock("paragraph")} hitSlop={6} className="px-2">
          <Pilcrow size={19} color={c.ink2} strokeWidth={1.9} />
        </Pressable>
        <View className="px-2">
          <Mic size={19} color={c.ink3} strokeWidth={1.7} />
        </View>
        <View className="px-2">
          <PenTool size={19} color={c.ink3} strokeWidth={1.7} />
        </View>
        <View className="px-2">
          <ImageIcon size={19} color={c.ink3} strokeWidth={1.7} />
        </View>
      </View>

      {/* Overflow menu */}
      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable onPress={() => setMenuOpen(false)} style={vars(themeVars)} className="flex-1">
          <View
            className="border-line bg-elev rounded-input absolute right-5 top-16 overflow-hidden border py-1"
            style={{ minWidth: 180, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}
          >
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setPinned.mutate({ id: note.id, isPinned: !note.is_pinned });
              }}
              className="px-4 py-2.5"
            >
              <Text className="text-ink text-[14px]">{note.is_pinned ? "Unpin" : "Pin"}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setMoveOpen(true);
              }}
              className="px-4 py-2.5"
            >
              <Text className="text-ink text-[14px]">Move to folder</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                del.mutate(note.id);
                goBack();
              }}
              className="px-4 py-2.5"
            >
              <Text className="text-high text-[14px]">Delete note</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Move-to-folder */}
      <Modal transparent visible={moveOpen} animationType="fade" onRequestClose={() => setMoveOpen(false)}>
        <Pressable onPress={() => setMoveOpen(false)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
          <Pressable onPress={() => {}} className="border-line bg-elev rounded-card max-h-[60%] w-full overflow-hidden border">
            <Text className="text-ink-3 px-4 pb-1 pt-3 font-mono text-[10px] font-semibold tracking-[0.14em]">MOVE TO</Text>
            <ScrollView>
              <Pressable
                onPress={() => {
                  updateNote.mutate({ id: note.id, patch: { folder_id: null } });
                  setMoveOpen(false);
                }}
                className="px-4 py-2.5"
              >
                <Text className={`text-[14px] ${note.folder_id === null ? "text-accent font-semibold" : "text-ink"}`}>No folder</Text>
              </Pressable>
              {folders.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    updateNote.mutate({ id: note.id, patch: { folder_id: f.id } });
                    setMoveOpen(false);
                  }}
                  className="px-4 py-2.5"
                >
                  <Text className={`text-[14px] ${note.folder_id === f.id ? "text-accent font-semibold" : "text-ink"}`}>{f.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
