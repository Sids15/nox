import {
  useArchiveIdea,
  useDeleteIdea,
  useIdeas,
  useSetIdeaStatus,
  useThemeColors,
  useUpdateIdea,
} from "@nox/features";
import type { ContentBlock, IdeaInput } from "@nox/types";
import { Archive, ArchiveRestore, ChevronLeft, CircleOff, Trash2, Undo2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { BlockList } from "../blocks/block-list";
import { BlockToolbar } from "../blocks/block-toolbar";
import { useBlockEditor } from "../blocks/use-block-editor";
import { useMediaBlocks } from "../blocks/use-media-blocks";
import { EditorTopBar } from "../editor-top-bar";
import { IdeaProperties } from "./idea-properties";
import { confirmDelete } from "../../lib/confirm";
import { useIsDesktop } from "../../lib/use-responsive";

/** The placeholder title a new idea is created with; the editor shows it as an empty field. */
const UNTITLED = "Untitled idea";

/**
 * The idea editor body — driven by an `id` (not the route params) so it works both as the standalone
 * `/idea/[id]` route and as the right-hand pane in the desktop master-detail Ideas screen. `onClose`
 * is what the back button / post-archive-drop-delete flow calls (router.back on the route, clear the
 * selection in the split). Renders no SafeAreaView / Sidebar — the caller owns the frame.
 */
export function IdeaEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();

  const { data: ideas = [] } = useIdeas();
  const idea = useMemo(() => ideas.find((i) => i.id === id), [ideas, id]);

  const updateIdea = useUpdateIdea();
  const setStatus = useSetIdeaStatus();
  const archive = useArchiveIdea();
  const del = useDeleteIdea();
  const patch = (p: Partial<IdeaInput>) => idea && updateIdea.mutate({ id: idea.id, patch: p });

  const [title, setTitle] = useState("");

  useEffect(() => {
    if (idea) setTitle(idea.title === UNTITLED ? "" : idea.title);
  }, [idea?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free-flow block content with debounced auto-save.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveContent = (content: ContentBlock[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (id) updateIdea.mutate({ id, patch: { content } });
    }, 600);
  };
  const editor = useBlockEditor(idea?.id ?? "", idea?.content ?? [], saveContent);
  const media = useMediaBlocks(idea?.id ?? "", editor);

  if (!idea) {
    return (
      <View className="flex-1">
        <View className="px-screen pt-2">
          <Pressable onPress={onClose} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink-2 mt-8 text-[15px]">Idea not found.</Text>
        </View>
      </View>
    );
  }


  return (
    <View className="flex-1">
      {/* maxWidth is a no-op on phones (< 680pt) and keeps the editor a readable column on desktop */}
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingBottom: 48, maxWidth: 680, width: "100%", alignSelf: "center", ...(isDesktop ? { paddingTop: 20 } : null) }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <EditorTopBar
          backLabel="Ideas"
          onBack={onClose}
          context={idea.is_archived ? "Archived" : idea.status === "dropped" ? "Dropped" : undefined}
          menu={[
            idea.is_archived
              ? { label: "Unarchive", icon: <ArchiveRestore size={15} color={c.ink2} strokeWidth={2} />, onPress: () => archive.mutate({ id: idea.id, isArchived: false }) }
              : {
                  label: "Archive",
                  icon: <Archive size={15} color={c.ink2} strokeWidth={2} />,
                  onPress: () => {
                    archive.mutate({ id: idea.id, isArchived: true });
                    onClose();
                  },
                },
            idea.status === "dropped"
              ? { label: "Bring back", icon: <Undo2 size={15} color={c.ink2} strokeWidth={2} />, onPress: () => setStatus.mutate({ id: idea.id, status: "raw" }) }
              : {
                  label: "Drop idea",
                  icon: <CircleOff size={15} color={c.ink2} strokeWidth={2} />,
                  onPress: () => {
                    setStatus.mutate({ id: idea.id, status: "dropped" });
                    onClose();
                  },
                },
            {
              label: "Delete idea",
              danger: true,
              divided: true,
              icon: <Trash2 size={15} color={c.high} strokeWidth={2} />,
              onPress: () =>
                confirmDelete({
                  title: "Delete idea?",
                  message: `“${idea.title}” will be deleted on all your devices. Archive keeps it out of the way instead.`,
                  onConfirm: () => {
                    del.mutate(idea.id);
                    onClose();
                  },
                }),
            },
          ]}
        />

        {/* Title */}
        <View className="px-screen mt-[22px]">
          <AutoGrowInput
            value={title}
            onChangeText={setTitle}
            onBlur={() => {
              const t = title.trim();
              if (t && t !== idea.title) patch({ title: t.slice(0, 200) });
            }}
            autoFocus={idea.title === UNTITLED}
            placeholder="What's the idea?"
            placeholderTextColor={c.ink3}
            minHeight={30}
            className="text-ink font-serif text-[24px] font-bold leading-[30px] tracking-[-0.01em]"
          />

          <IdeaProperties
            idea={idea}
            onStatus={(status) => setStatus.mutate({ id: idea.id, status })}
            onPriority={(priority) => patch({ priority })}
            onTags={(tags) => patch({ tags })}
          />
        </View>

        {/* Writing canvas — the idea's free-flow body (controls above, document below). flex-1 lets it
            absorb spare height (paired with the ScrollView's flexGrow) so the meta line below always
            clears the floating toolbar instead of hiding under it when the idea is short. */}
        <View className="mx-screen border-line mt-4 border-t" />
        <View className="px-screen mt-5 flex-1" style={{ minHeight: 280 }}>
          <BlockList
            blocks={editor.blocks}
            setText={editor.setText}
            removeBlock={editor.removeBlock}
            firstPlaceholder="Write it out: what is it, why it matters, what you'd try first…"
          />
        </View>
      </ScrollView>

      <BlockToolbar
        onAddHeading={editor.addHeading}
        onAddParagraph={editor.addParagraph}
        onAddLink={editor.addLink}
        onAddImage={media.addImage}
        onRecordComplete={media.addAudio}
      />

    </View>
  );
}
