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
import { Folder, FolderPlus, Hash, MoreHorizontal, NotebookPen, Plus, Search } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ResizablePane } from "../../components/resizable-pane";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fab, useHideOnScroll } from "../../components/fab";
import { DesktopHeader } from "../../components/desktop-header";
import { EmptyState } from "../../components/empty-state";
import { ListSkeleton } from "../../components/skeleton";
import { confirmDelete, plural } from "../../lib/confirm";
import { useIsDesktop } from "../../lib/use-responsive";
import { NoteEditor } from "../../components/notes/note-editor";
import { NoteRow } from "../../components/notes/note-row";
import { groupNotesByDate, noteMatches } from "../../components/notes/note-utils";
import { TagChip } from "../../components/tag-chip";
import { tagCounts } from "../../components/tag-editor";
import { tagColor } from "../../lib/tag-palette";
import { ProfileAvatar } from "../../components/profile-avatar";
import { SectionHeading } from "../../components/section-heading";
import { pressScale } from "../../components/menu";

function SectionLabel({ children }: { children: string }) {
  return <SectionHeading className="mt-4">{children}</SectionHeading>;
}

/** A group of rows on the page — flat with a hairline above, like the Tasks list, not a boxed card. */
function Card({ children }: { children: ReactNode }) {
  return <View className="border-line border-t">{children}</View>;
}

/**
 * Notes as a list: pinned first, then grouped by when they were last edited (Today, Yesterday,
 * Previous 7 days…). `folderNameOf` adds each note's folder when the list spans folders.
 */
function NoteList({
  notes,
  selectedId,
  onOpen,
  folderNameOf,
  showPinned = true,
}: {
  notes: Note[];
  selectedId?: string | null;
  onOpen: (n: Note) => void;
  folderNameOf?: (n: Note) => string | undefined;
  showPinned?: boolean;
}) {
  const pinned = showPinned ? notes.filter((n) => n.is_pinned) : [];
  const groups = groupNotesByDate(showPinned ? notes.filter((n) => !n.is_pinned) : notes);
  const all = [...(pinned.length ? [{ label: "Pinned", notes: pinned }] : []), ...groups];
  return (
    <View>
      {all.map((g) => (
        <View key={g.label}>
          <SectionLabel>{g.label}</SectionLabel>
          <View className="gap-0.5">
            {g.notes.map((n) => (
              <NoteRow
                key={n.id}
                note={n}
                selected={n.id === selectedId}
                onPress={() => onOpen(n)}
                folderName={folderNameOf?.(n)}
                // Under "Today" / "Yesterday" the day is already said: show the time.
                timeOnly={g.label === "Today" || g.label === "Yesterday"}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      // Same row as the Resources library rail and the sidebar: medium weight, semibold when current.
      className={`h-[36px] flex-row items-center gap-2.5 rounded-[10px] px-[11px] ${active ? "bg-accent/[0.12]" : "hover:bg-chip"}`}
    >
      <Icon size={15} color={active ? c.accent : c.ink2} strokeWidth={2} />
      <Text numberOfLines={1} className={`flex-1 text-[14px] ${active ? "text-accent font-semibold" : "text-ink-2 font-medium"}`}>
        {label}
      </Text>
      <Text style={{ fontVariant: ["tabular-nums"] }} className="text-ink-3 text-[12px]">
        {count}
      </Text>
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
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const tags = useMemo(() => tagCounts(active), [active]);
  useEffect(() => {
    if (selectedTag && !tags.some((t) => t.tag === selectedTag)) setSelectedTag(null);
  }, [tags, selectedTag]);
  const filtered = useMemo(
    () => active.filter((n) => noteMatches(n, search) && (!selectedTag || n.tags.includes(selectedTag))),
    [active, search, selectedTag],
  );
  const folderNameOf = (n: Note) => (n.folder_id ? folders.find((f) => f.id === n.folder_id)?.name : undefined);
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
    const selectedNote = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : undefined;
    const selectedFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) : undefined;
    const scopeLabel = selectedFolder ? selectedFolder.name : "All notes";

    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        <View className="flex-1 flex-row">
          {/* Pane 1 — folders */}
          <ResizablePane id="notes.folders" initial={248} min={180} max={380} className="border-line border-r px-2 pt-6">
            <View className="px-[9px]">
              <Text className="text-ink font-serif text-[20px] font-bold">Notes</Text>
            </View>
            <Text className="text-ink-3 mb-3 mt-1 px-[9px] text-[13px] font-medium">
              {plural(active.length, "note")} · {plural(folders.length, "folder")}
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
                {/* New folder lives with the folders (it was a grey circle in the pane's corner). */}
                <Pressable
                  onPress={() => setNewFolderOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="New folder"
                  className="hover:bg-chip h-[36px] flex-row items-center gap-2.5 rounded-[10px] px-[11px]"
                >
                  <Plus size={15} color={c.ink3} strokeWidth={2} />
                  <Text className="text-ink-3 text-[14px] font-medium">New folder</Text>
                </Pressable>
              </View>
              {tags.length > 0 && (
                <View className="mt-5">
                  <Text className="text-ink-2 mb-1.5 px-[11px] text-[13px] font-semibold">Tags</Text>
                  <View className="gap-0.5">
                    {tags.map(({ tag, count }) => {
                      const on = selectedTag === tag;
                      return (
                        <Pressable
                          key={tag}
                          onPress={() => setSelectedTag(on ? null : tag)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          className={`flex-row items-center gap-2.5 rounded-[10px] px-[11px] py-[7px] ${on ? "bg-accent/[0.12]" : "hover:bg-chip"}`}
                        >
                          <Hash size={14} color={tagColor(tag)} strokeWidth={2.4} />
                          <Text numberOfLines={1} className={`flex-1 text-[14px] ${on ? "text-accent font-semibold" : "text-ink-2 font-medium"}`}>
                            {tag}
                          </Text>
                          <Text className="text-ink-3 text-[12px]">{count}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </ResizablePane>

          {/* Pane 2 — note list */}
          <ResizablePane id="notes.list" initial={320} min={240} max={560} className="border-line border-r pt-6">
            <View className="px-3">
              {/* Scope header — folder name + rename/delete (act on the selected folder) */}
              <View className="mb-3 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-ink font-serif text-[20px] font-bold">
                    {scopeLabel}
                  </Text>
                  {selectedTag && (
                    <Pressable onPress={() => setSelectedTag(null)} accessibilityRole="button" accessibilityLabel={`Clear tag ${selectedTag}`} className="mt-1 flex-row items-center gap-1 self-start">
                      <TagChip tag={selectedTag} size="sm" onRemove={() => setSelectedTag(null)} />
                    </Pressable>
                  )}
                </View>
                {selectedFolder && (
                  <Pressable
                    onPress={() => setFolderMenuOpen((v) => !v)}
                    accessibilityLabel="Folder options"
                    className="hover:bg-chip ml-1 h-[30px] w-[30px] items-center justify-center rounded-[9px]"
                  >
                    <MoreHorizontal size={16} color={c.ink2} strokeWidth={2} />
                  </Pressable>
                )}
                <Pressable
                  onPress={createAndOpen}
                  accessibilityRole="button"
                  accessibilityLabel="New note"
                  style={pressScale}
                  className="bg-accent hover:opacity-90 ml-1.5 h-[30px] flex-row items-center gap-1 rounded-[9px] px-2.5"
                >
                  <Plus size={14} color={c.onAccent} strokeWidth={2.4} />
                  <Text className="text-on-accent text-[13px] font-semibold">New</Text>
                </Pressable>
              </View>
              <View className="bg-surface border-line h-10 flex-row items-center gap-2.5 rounded-[10px] border px-3">
                <Search size={14} color={c.ink3} strokeWidth={2} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search notes…"
                  placeholderTextColor={c.ink3}
                  className="text-ink flex-1 text-[14px]"
                  style={{ paddingVertical: 0 }}
                />
              </View>
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
                    icon={search || selectedTag ? Search : NotebookPen}
                    title={search || selectedTag ? "No notes match" : "No notes here"}
                    subtitle={search || selectedTag ? "Try a different search or tag." : "Create one to fill this folder."}
                  />
                ) : (
                  <NoteList
                    notes={scoped}
                    selectedId={selectedNoteId}
                    onOpen={openNote}
                    folderNameOf={selectedFolderId === null ? folderNameOf : undefined}
                  />
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
          </ResizablePane>

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
            <Text className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">Notes</Text>
            <Text className="text-ink-3 mt-0.5 text-[14px] font-medium">
              {plural(active.length, "note")} · {plural(folders.length, "folder")}
            </Text>
          </View>
          <View className="pt-1">
            <ProfileAvatar />
          </View>
        </View>

        <View className="px-screen mt-5">
          <View className="bg-chip rounded-input h-11 flex-row items-center gap-[10px] px-[13px]">
            <Search size={15} color={c.ink3} strokeWidth={2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search notes…"
              placeholderTextColor={c.ink3}
              className="text-ink flex-1 text-[15px]"
              style={{ paddingVertical: 0 }}
            />
          </View>
        </View>

        {tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
            {tags.map(({ tag }) => {
              const on = selectedTag === tag;
              return (
                <Pressable
                  key={tag}
                  onPress={() => setSelectedTag(on ? null : tag)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  className="rounded-pill px-3 py-[6px]"
                  style={{ backgroundColor: on ? tagColor(tag) : `${tagColor(tag)}1f` }}
                >
                  <Text style={{ color: on ? "#fff" : tagColor(tag) }} className="text-[13px] font-semibold">
                    #{tag}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

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
              {/* Pinned notes as the same rows as the rest — all of them, not only the first two. */}
              {pinned.length > 0 && <NoteList notes={pinned} onOpen={openNote} folderNameOf={folderNameOf} />}

              {/* Folders as a row of tiles that scrolls sideways: as a list they filled the first screen. */}
              {!selectedTag && !search && (
                <>
                  <SectionLabel>Folders</SectionLabel>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -20 }}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
                  >
                    {folders.map((f) => (
                      <Pressable
                        key={f.id}
                        onPress={() => router.push(`/folder/${f.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${f.name}, ${plural(noteCount(f.id), "note")}`}
                        style={pressScale}
                        className="border-line bg-surface w-[128px] rounded-[14px] border px-3 py-3"
                      >
                        <Folder size={18} color={c.accent} strokeWidth={2} />
                        <Text numberOfLines={1} className="text-ink mt-2.5 text-[15px] font-semibold">
                          {f.name}
                        </Text>
                        <Text style={{ fontVariant: ["tabular-nums"] }} className="text-ink-3 mt-0.5 text-[13px]">
                          {plural(noteCount(f.id), "note")}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => setNewFolderOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="New folder"
                      style={pressScale}
                      className="border-line w-[96px] items-center justify-center rounded-[14px] border border-dashed"
                    >
                      <FolderPlus size={18} color={c.ink3} strokeWidth={2} />
                      <Text className="text-ink-3 mt-1.5 text-[13px] font-semibold">New</Text>
                    </Pressable>
                  </ScrollView>
                </>
              )}

              {recent.length > 0 ? (
                <NoteList notes={recent} onOpen={openNote} folderNameOf={folderNameOf} showPinned={false} />
              ) : search || selectedTag ? (
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
