import {
  useCreateFolder,
  useCreateNote,
  useDeleteFolder,
  useFolders,
  useNotes,
  useRenameFolder,
  useThemeColors,
  useThemeVars,
} from "@nox/features";
import type { LucideIcon } from "lucide-react-native";
import type { Note } from "@nox/types";
import { useRouter } from "expo-router";
import { ChevronRight, Folder, FolderPlus, MoreHorizontal, NotebookPen, Plus, Search } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fab, useHideOnScroll } from "../../components/fab";
import { DesktopHeader } from "../../components/desktop-header";
import { EmptyState } from "../../components/empty-state";
import { ListSkeleton } from "../../components/skeleton";
import { confirmDelete, plural } from "../../lib/confirm";
import { useIsDesktop } from "../../lib/use-responsive";
import { NoteEditor } from "../../components/notes/note-editor";
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

/** A folder-pane nav row (desktop): icon · name · count. Folder actions live in the note-list header. */
function FolderNavRow({
  icon: Icon,
  label,
  count,
  active,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-2.5 rounded-[10px] px-[11px] py-2 ${active ? "bg-accent/[0.12]" : "hover:bg-chip"}`}
    >
      <Icon size={16} color={active ? c.accent : c.ink2} strokeWidth={1.8} />
      <Text numberOfLines={1} className={`flex-1 text-[13px] font-semibold ${active ? "text-accent" : "text-ink-2"}`}>
        {label}
      </Text>
      <Text className="text-ink-3 font-mono text-[10.5px] font-medium">{count}</Text>
    </Pressable>
  );
}

export default function NotesScreen() {
  const fab = useHideOnScroll();
  const router = useRouter();
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  // Desktop 3-pane state: which folder scopes the list, which note is open, folder ⋯ menu / rename.
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: notes = [], isLoading, isError, refetch } = useNotes();
  const { data: folders = [] } = useFolders();
  const createNote = useCreateNote();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();

  const active = useMemo(() => notes.filter((n) => !n.is_archived), [notes]);

  // Desktop opens the most recent note on arrival (pinned first) so the editor pane starts with
  // something in it, the way a notes app does. Once only: after the user closes a note, or picks a
  // folder, the empty pane is their choice and must not be refilled behind their back.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!isDesktop || autoOpened.current || isLoading || selectedNoteId) return;
    autoOpened.current = true;
    const first = active.find((n) => n.is_pinned) ?? active[0];
    if (first) setSelectedNoteId(first.id);
  }, [isDesktop, isLoading, active, selectedNoteId]);
  const filtered = useMemo(() => active.filter((n) => noteMatches(n, search)), [active, search]);
  const pinned = filtered.filter((n) => n.is_pinned);
  const recent = filtered.filter((n) => !n.is_pinned);
  const noteCount = (folderId: string) => active.filter((n) => n.folder_id === folderId).length;

  const openNote = (n: Note) => {
    if (isDesktop) setSelectedNoteId(n.id);
    else router.push(`/note/${n.id}`);
  };
  const createAndOpen = () => {
    const id = createNote.create({
      title: null,
      type: "text",
      content: [{ type: "paragraph", text: "" }],
      // Desktop: drop the new note into whatever folder is in focus.
      folder_id: isDesktop ? selectedFolderId : null,
      tags: [],
    });
    if (isDesktop) setSelectedNoteId(id);
    else router.push(`/note/${id}`);
  };
  const submitFolder = () => {
    const name = folderName.trim();
    if (name) createFolder.create({ name, parent_id: null });
    setFolderName("");
    setNewFolderOpen(false);
  };
  const submitRename = () => {
    const next = renameValue.trim();
    if (next && renameId) renameFolder.mutate({ id: renameId, name: next });
    setRenameId(null);
  };
  const removeFolder = (fid: string) => {
    const name = folders.find((f) => f.id === fid)?.name ?? "this folder";
    const count = noteCount(fid);
    confirmDelete({
      title: `Delete “${name}”?`,
      message:
        count > 0
          ? `Its ${plural(count, "note")} won't be deleted — ${count === 1 ? "it moves" : "they move"} to All notes.`
          : "This folder is empty.",
      confirmLabel: "Delete folder",
      onConfirm: () => {
        deleteFolder.mutate(fid);
        if (selectedFolderId === fid) setSelectedFolderId(null);
      },
    });
  };

  // ── Desktop: folders · note list · editor ─────────────────────────────────────────────────────
  if (isDesktop) {
    const scoped = filtered.filter((n) => selectedFolderId === null || n.folder_id === selectedFolderId);
    const scopedPinned = scoped.filter((n) => n.is_pinned);
    const scopedRecent = scoped.filter((n) => !n.is_pinned);
    const selectedNote = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : undefined;
    const selectedFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
    const scopeLabel = selectedFolder ? selectedFolder.name : "All notes";

    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        <View className="flex-1 flex-row">
          {/* Pane 1 — folders */}
          <View className="border-line w-[248px] border-r px-2 pt-6">
            <View className="flex-row items-center justify-between px-[9px]">
              <Text className="text-ink text-[17px] font-bold tracking-[-0.02em]">Notes</Text>
              <Pressable
                onPress={() => setNewFolderOpen(true)}
                accessibilityLabel="New folder"
                className="bg-chip rounded-pill hover:bg-elev h-[30px] w-[30px] items-center justify-center"
              >
                <FolderPlus size={15} color={c.ink2} strokeWidth={1.8} />
              </Pressable>
            </View>
            <Text className="text-ink-3 mb-3 mt-1.5 px-[9px] font-mono text-[10px] font-medium tracking-[0.14em]">
              {active.length} NOTES · {folders.length} FOLDERS
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View className="gap-0.5">
                <FolderNavRow
                  icon={NotebookPen}
                  label="All notes"
                  count={active.length}
                  active={selectedFolderId === null}
                  onPress={() => setSelectedFolderId(null)}
                />
                {folders.map((f) => (
                  <FolderNavRow
                    key={f.id}
                    icon={Folder}
                    label={f.name}
                    count={noteCount(f.id)}
                    active={selectedFolderId === f.id}
                    onPress={() => setSelectedFolderId(f.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Pane 2 — note list */}
          <View className="border-line w-[320px] border-r pt-6">
            <View className="px-3">
              {/* Scope header — folder name + rename/delete (act on the selected folder) */}
              <View className="mb-3 flex-row items-center justify-between">
                <Text numberOfLines={1} className="text-ink flex-1 text-[15px] font-bold tracking-[-0.02em]">
                  {scopeLabel}
                </Text>
                {selectedFolder && (
                  <Pressable
                    onPress={() => setFolderMenuOpen((v) => !v)}
                    accessibilityLabel="Folder options"
                    className="bg-chip rounded-pill hover:bg-elev ml-2 h-[28px] w-[28px] items-center justify-center"
                  >
                    <MoreHorizontal size={15} color={c.ink2} strokeWidth={1.8} />
                  </Pressable>
                )}
              </View>
              <View className="bg-chip border-line rounded-input h-10 flex-row items-center gap-2.5 border px-3">
                <Search size={14} color={c.ink3} strokeWidth={1.8} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search notes…"
                  placeholderTextColor={c.ink3}
                  className="text-ink flex-1 text-[13.5px]"
                  style={{ paddingVertical: 0 }}
                />
              </View>
              <Pressable
                onPress={createAndOpen}
                className="bg-accent/[0.12] rounded-input mt-2.5 h-10 flex-row items-center justify-center gap-2"
              >
                <Plus size={15} color={c.accent} strokeWidth={2.2} />
                <Text className="text-accent text-[13.5px] font-semibold">New note</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <View className="px-3">
                {isError && notes.length === 0 ? (
                  <EmptyState
                    icon={NotebookPen}
                    title="Couldn't load notes"
                    subtitle="Check your connection and try again."
                    actionLabel="Try again"
                    onAction={() => refetch()}
                  />
                ) : isLoading && notes.length === 0 ? (
                  <View className="mt-3">
                    <ListSkeleton />
                  </View>
                ) : scoped.length === 0 ? (
                  <EmptyState
                    icon={search ? Search : NotebookPen}
                    title={search ? "No notes match" : "No notes here"}
                    subtitle={search ? "Try a different search." : "Create one to fill this folder."}
                  />
                ) : (
                  <>
                    {scopedPinned.length > 0 && (
                      <>
                        <SectionLabel>PINNED</SectionLabel>
                        <Card>
                          {scopedPinned.map((n, i) => (
                            <View key={n.id}>
                              {i > 0 && <View className="bg-line ml-[14px] h-px" />}
                              <NoteRow note={n} selected={n.id === selectedNoteId} onPress={() => openNote(n)} />
                            </View>
                          ))}
                        </Card>
                      </>
                    )}
                    {scopedRecent.length > 0 && (
                      <>
                        <SectionLabel>NOTES</SectionLabel>
                        <Card>
                          {scopedRecent.map((n, i) => (
                            <View key={n.id}>
                              {i > 0 && <View className="bg-line ml-[14px] h-px" />}
                              <NoteRow note={n} selected={n.id === selectedNoteId} onPress={() => openNote(n)} />
                            </View>
                          ))}
                        </Card>
                      </>
                    )}
                  </>
                )}
              </View>
            </ScrollView>

            {/* Folder actions dropdown — anchored inside this pane, under the header ⋯ */}
            {folderMenuOpen && (
              <>
                <Pressable onPress={() => setFolderMenuOpen(false)} className="absolute inset-0 z-10" />
                <View
                  className="border-line bg-elev rounded-input absolute right-3 top-[56px] z-20 overflow-hidden border py-1"
                  style={{ minWidth: 168, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}
                >
                  <Pressable
                    onPress={() => {
                      setFolderMenuOpen(false);
                      setRenameValue(selectedFolder?.name ?? "");
                      setRenameId(selectedFolderId);
                    }}
                    className="hover:bg-chip px-4 py-2.5"
                  >
                    <Text className="text-ink text-[14px]">Rename folder</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setFolderMenuOpen(false);
                      if (selectedFolderId) removeFolder(selectedFolderId);
                    }}
                    className="hover:bg-chip border-line border-t px-4 py-2.5"
                  >
                    <Text className="text-high text-[14px]">Delete folder</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          {/* Pane 3 — editor */}
          <View className="flex-1">
            {selectedNote ? (
              <NoteEditor key={selectedNoteId} id={selectedNoteId!} onClose={() => setSelectedNoteId(null)} />
            ) : (
              <View className="flex-1 items-center justify-center">
                <EmptyState
                  icon={NotebookPen}
                  title="No note selected"
                  subtitle="Pick a note to read or edit, or start a new one."
                  actionLabel="New note"
                  onAction={createAndOpen}
                />
              </View>
            )}
          </View>
        </View>

        {/* New folder modal */}
        <FolderNameModal
          visible={newFolderOpen}
          title="New folder"
          value={folderName}
          onChange={setFolderName}
          onSubmit={submitFolder}
          onCancel={() => setNewFolderOpen(false)}
          submitLabel="Create"
        />

        {/* Rename folder modal */}
        <FolderNameModal
          visible={renameId !== null}
          title="Rename folder"
          value={renameValue}
          onChange={setRenameValue}
          onSubmit={submitRename}
          onCancel={() => setRenameId(null)}
          submitLabel="Save"
        />
      </SafeAreaView>
    );
  }

  // ── Mobile: Notes home (pinned cards · folders · recent) ──────────────────────────────────────
  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView
        onScroll={fab.onScroll}
        scrollEventThrottle={16}
       
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-screen flex-row items-start justify-between pt-2">
          <View>
            <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">
              {active.length} NOTES · {folders.length} FOLDERS
            </Text>
            <Text className="text-ink mt-2 text-[30px] font-bold leading-[33px] tracking-[-0.02em]">
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

        <View className="px-screen mt-5">
          <View className="bg-chip rounded-input h-11 flex-row items-center gap-[10px] px-[13px]">
            <Search size={15} color={c.ink3} strokeWidth={1.8} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search notes…"
              placeholderTextColor={c.ink3}
              className="text-ink flex-1 text-[14.5px]"
              style={{ paddingVertical: 0 }}
            />
          </View>
        </View>

        <View className="px-screen">
          {isError && notes.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="Couldn't load your notes"
              subtitle="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          ) : isLoading && notes.length === 0 ? (
            <View className="mt-2">
              <ListSkeleton />
            </View>
          ) : active.length === 0 && folders.length === 0 ? (
            search ? (
              <EmptyState icon={Search} title="No notes match" subtitle="Try a different search." />
            ) : (
              <EmptyState
                icon={NotebookPen}
                title="Start your first note"
                subtitle="Text, checklists, photos, and voice — organized into folders when you want."
                actionLabel="New note"
                onAction={createAndOpen}
              />
            )
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

              {recent.length > 0 ? (
                <>
                  <SectionLabel>RECENT</SectionLabel>
                  <Card>
                    {recent.map((n, i) => (
                      <View key={n.id}>
                        {i > 0 && <View className="bg-line ml-[14px] h-px" />}
                        <NoteRow note={n} onPress={() => openNote(n)} />
                      </View>
                    ))}
                  </Card>
                </>
              ) : search ? (
                <Text className="text-ink-3 mt-6 text-center text-[14px]">No notes match.</Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Fab onPress={createAndOpen} label="New note" bottom={112} visible={fab.visible} />

      {/* New folder modal */}
      <FolderNameModal
        visible={newFolderOpen}
        title="New folder"
        value={folderName}
        onChange={setFolderName}
        onSubmit={submitFolder}
        onCancel={() => setNewFolderOpen(false)}
        submitLabel="Create"
      />
    </SafeAreaView>
  );
}

/** Shared new-folder / rename-folder modal (a single labeled input + Cancel/confirm). */
function FolderNameModal({
  visible,
  title,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  visible: boolean;
  title: string;
  value: string;
  onChange: (t: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={vars(themeVars)} className="flex-1 items-center justify-center bg-black/60 px-8">
        <Pressable onPress={() => {}} className="border-line bg-elev rounded-card w-full max-w-[380px] border p-4">
          <Text className="text-ink mb-3 text-[15px] font-semibold">{title}</Text>
          <TextInput
            autoFocus
            value={value}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            returnKeyType="done"
            placeholder="Folder name"
            placeholderTextColor={c.ink3}
            className="bg-chip rounded-input text-ink mb-3 h-11 px-3 text-[14px]"
            style={{ paddingVertical: 0 }}
          />
          <View className="flex-row justify-end gap-2">
            <Pressable onPress={onCancel} className="px-4 py-2">
              <Text className="text-ink-2 text-[14px]">Cancel</Text>
            </Pressable>
            <Pressable onPress={onSubmit} className="bg-accent rounded-input px-4 py-2">
              <Text className="text-on-accent text-[14px] font-semibold">{submitLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
