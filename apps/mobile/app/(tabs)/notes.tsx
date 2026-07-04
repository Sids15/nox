import {
  useCreateFolder,
  useCreateNote,
  useFolders,
  useNotes,
  useThemeColors,
  useThemeVars,
} from "@nox/features";
import type { Note } from "@nox/types";
import { useRouter } from "expo-router";
import { ChevronRight, Folder, FolderPlus, Plus, Search } from "lucide-react-native";
import { vars } from "nativewind";
import { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NoteRow } from "../../components/notes/note-row";
import { PinnedNoteCard } from "../../components/notes/pinned-note-card";
import { noteMatches } from "../../components/notes/note-utils";
import { ProfileAvatar } from "../../components/profile-avatar";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-3 mb-2 mt-4 pl-0.5 font-mono text-[10px] font-semibold tracking-[0.14em]">
      {children}
    </Text>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View className="border-line bg-surface rounded-card overflow-hidden border">{children}</View>;
}

export default function NotesScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const [search, setSearch] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  const { data: notes = [], isLoading } = useNotes();
  const { data: folders = [] } = useFolders();
  const createNote = useCreateNote();
  const createFolder = useCreateFolder();

  const active = useMemo(() => notes.filter((n) => !n.is_archived), [notes]);
  const filtered = useMemo(() => active.filter((n) => noteMatches(n, search)), [active, search]);
  const pinned = filtered.filter((n) => n.is_pinned);
  const recent = filtered.filter((n) => !n.is_pinned);
  const noteCount = (folderId: string) => active.filter((n) => n.folder_id === folderId).length;

  const openNote = (n: Note) => router.push(`/note/${n.id}`);
  const createAndOpen = () => {
    const id = createNote.create({
      title: null,
      type: "text",
      content: [{ type: "paragraph", text: "" }],
      folder_id: null,
      tags: [],
    });
    router.push(`/note/${id}`);
  };
  const submitFolder = () => {
    const name = folderName.trim();
    if (name) createFolder.create({ name, parent_id: null });
    setFolderName("");
    setNewFolderOpen(false);
  };

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-screen flex-row items-start justify-between pt-2">
          <View>
            <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">
              {active.length} NOTES · {folders.length} FOLDERS
            </Text>
            <Text className="text-ink mt-[3px] text-[30px] font-bold leading-[33px] tracking-[-0.02em]">
              Notes
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setNewFolderOpen(true)}
              className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center"
            >
              <FolderPlus size={16} color={c.ink2} strokeWidth={1.8} />
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
              placeholder="Search notes…"
              placeholderTextColor={c.ink3}
              className="text-ink flex-1 text-[14.5px]"
            />
          </View>
        </View>

        <View className="px-screen">
          {isLoading && notes.length === 0 ? (
            <View className="mt-16 items-center">
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <SectionLabel>PINNED</SectionLabel>
                  <View className="flex-row gap-[10px]">
                    {pinned.slice(0, 2).map((n) => (
                      <PinnedNoteCard key={n.id} note={n} onPress={() => openNote(n)} />
                    ))}
                    {pinned.length === 1 && <View className="flex-1" />}
                  </View>
                </>
              )}

              {folders.length > 0 && (
                <>
                  <SectionLabel>FOLDERS</SectionLabel>
                  <Card>
                    {folders.map((f, i) => (
                      <View key={f.id}>
                        {i > 0 && <View className="bg-line ml-[14px] h-px" />}
                        <Pressable
                          onPress={() => router.push(`/folder/${f.id}`)}
                          className="min-h-[50px] flex-row items-center gap-3 px-[14px]"
                        >
                          <Folder size={17} color={c.ink2} strokeWidth={1.7} />
                          <Text className="text-ink flex-1 text-[14.5px] font-medium">{f.name}</Text>
                          <Text className="text-ink-3 font-mono text-[11px]">{noteCount(f.id)}</Text>
                          <ChevronRight size={14} color={c.ink3} strokeWidth={2} />
                        </Pressable>
                      </View>
                    ))}
                  </Card>
                </>
              )}

              <SectionLabel>RECENT</SectionLabel>
              {recent.length > 0 ? (
                <Card>
                  {recent.map((n, i) => (
                    <View key={n.id}>
                      {i > 0 && <View className="bg-line ml-[14px] h-px" />}
                      <NoteRow note={n} onPress={() => openNote(n)} />
                    </View>
                  ))}
                </Card>
              ) : (
                <Text className="text-ink-3 mt-4 text-center text-[14px]">
                  {search ? "No notes match." : "No notes yet — tap + to write one."}
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={createAndOpen}
        accessibilityRole="button"
        accessibilityLabel="New note"
        className="bg-accent rounded-fab absolute h-[54px] w-[54px] items-center justify-center"
        style={{
          right: 20,
          bottom: 112,
          shadowColor: c.accent,
          shadowOpacity: 0.4,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Plus size={22} color={c.onAccent} strokeWidth={2.2} />
      </Pressable>

      {/* New folder modal */}
      <Modal transparent visible={newFolderOpen} animationType="fade" onRequestClose={() => setNewFolderOpen(false)}>
        <Pressable
          onPress={() => setNewFolderOpen(false)}
          style={vars(themeVars)}
          className="flex-1 items-center justify-center bg-black/60 px-8"
        >
          <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full border p-4">
            <Text className="text-ink mb-3 text-[15px] font-semibold">New folder</Text>
            <TextInput
              autoFocus
              value={folderName}
              onChangeText={setFolderName}
              onSubmitEditing={submitFolder}
              returnKeyType="done"
              placeholder="Folder name"
              placeholderTextColor={c.ink3}
              className="bg-chip rounded-input text-ink mb-3 h-11 px-3 text-[14px]"
              style={{ paddingVertical: 0 }}
            />
            <View className="flex-row justify-end gap-2">
              <Pressable onPress={() => setNewFolderOpen(false)} className="px-4 py-2">
                <Text className="text-ink-2 text-[14px]">Cancel</Text>
              </Pressable>
              <Pressable onPress={submitFolder} className="bg-accent rounded-input px-4 py-2">
                <Text className="text-on-accent text-[14px] font-semibold">Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
