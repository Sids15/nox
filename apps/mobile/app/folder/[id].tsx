import {
  useCreateNote,
  useDeleteFolder,
  useFolders,
  useNotes,
  useRenameFolder,
  useThemeColors,
  useThemeVars,
} from "@nox/features";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, FolderOpen, MoreHorizontal } from "lucide-react-native";
import { vars } from "nativewind";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fab, useHideOnScroll } from "../../components/fab";
import { EmptyState } from "../../components/empty-state";
import { confirmDelete, plural } from "../../lib/confirm";
import { NoteRow } from "../../components/notes/note-row";
import { goBack } from "../../lib/go-back";

export default function FolderScreen() {
  const fab = useHideOnScroll();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const themeVars = useThemeVars();

  const { data: folders = [] } = useFolders();
  const { data: notes = [] } = useNotes();
  const createNote = useCreateNote();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();

  const folder = folders.find((f) => f.id === id);
  const folderNotes = useMemo(
    () => notes.filter((n) => n.folder_id === id && !n.is_archived),
    [notes, id],
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");

  const back = () => goBack("/notes");
  const createInFolder = () => {
    const newId = createNote.create({
      title: null,
      type: "text",
      content: [{ type: "paragraph", text: "" }],
      folder_id: id ?? null,
      tags: [],
    });
    router.push(`/note/${newId}`);
  };
  const submitRename = () => {
    const next = name.trim();
    if (next && id) renameFolder.mutate({ id, name: next });
    setRenameOpen(false);
  };

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      {/* Header */}
      <View className="px-screen flex-row items-center justify-between pt-2">
        <Pressable onPress={back} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
          <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center"
        >
          <MoreHorizontal size={20} color={c.ink2} strokeWidth={1.7} />
        </Pressable>
      </View>
      <View className="px-screen mt-3">
        <Text className="text-ink text-[26px] font-bold tracking-[-0.02em]">
          {folder?.name ?? "Folder"}
        </Text>
        <Text className="text-ink-3 mt-1 font-mono text-[10.5px] tracking-[0.14em]">
          {folderNotes.length} NOTES
        </Text>
      </View>

      <ScrollView
        onScroll={fab.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        <View className="px-screen mt-4">
          {folderNotes.length > 0 ? (
            <View className="border-line bg-surface rounded-card overflow-hidden border">
              {folderNotes.map((n, i) => (
                <View key={n.id}>
                  {i > 0 && <View className="bg-line ml-[14px] h-px" />}
                  <NoteRow note={n} onPress={() => router.push(`/note/${n.id}`)} />
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="This folder is empty"
              subtitle="Add a note here to keep related thoughts together."
              actionLabel="New note"
              onAction={createInFolder}
            />
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Fab onPress={createInFolder} label="New note in folder" bottom={40} visible={fab.visible} />

      {/* Overflow menu */}
      <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable onPress={() => setMenuOpen(false)} style={vars(themeVars)} className="flex-1">
          <View
            className="border-line bg-elev rounded-input absolute right-5 top-16 overflow-hidden border py-1"
            style={{ minWidth: 170, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}
          >
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setName(folder?.name ?? "");
                setRenameOpen(true);
              }}
              className="px-4 py-2.5"
            >
              <Text className="text-ink text-[14px]">Rename folder</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                if (!id) return;
                confirmDelete({
                  title: `Delete “${folder?.name ?? "this folder"}”?`,
                  message:
                    folderNotes.length > 0
                      ? `Its ${plural(folderNotes.length, "note")} won't be deleted — ${folderNotes.length === 1 ? "it moves" : "they move"} to All notes.`
                      : "This folder is empty.",
                  confirmLabel: "Delete folder",
                  onConfirm: () => {
                    deleteFolder.mutate(id);
                    back();
                  },
                });
              }}
              className="px-4 py-2.5"
            >
              <Text className="text-high text-[14px]">Delete folder</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Rename modal */}
      <Modal transparent visible={renameOpen} animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <Pressable onPress={() => setRenameOpen(false)} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
          <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[380px] border p-4">
            <Text className="text-ink mb-3 text-[15px] font-semibold">Rename folder</Text>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              onSubmitEditing={submitRename}
              returnKeyType="done"
              placeholder="Folder name"
              placeholderTextColor={c.ink3}
              className="bg-chip rounded-input text-ink mb-3 h-11 px-3 text-[14px]"
              style={{ paddingVertical: 0 }}
            />
            <View className="flex-row justify-end gap-2">
              <Pressable onPress={() => setRenameOpen(false)} className="px-4 py-2">
                <Text className="text-ink-2 text-[14px]">Cancel</Text>
              </Pressable>
              <Pressable onPress={submitRename} className="bg-accent rounded-input px-4 py-2">
                <Text className="text-on-accent text-[14px] font-semibold">Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
