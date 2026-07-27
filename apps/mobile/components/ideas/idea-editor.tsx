import {
  useArchiveIdea,
  useDeleteIdea,
  useIdeas,
  useSetIdeaStatus,
  useThemeColors,
  useUpdateIdea,
} from "@nox/features";
import { priorityLevels, type ContentBlock, type Idea, type IdeaInput } from "@nox/types";
import { capitalize as cap, relativeFromNow, shortDate } from "@nox/utils";
import { ChevronLeft, MoreHorizontal, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { BlockList } from "../blocks/block-list";
import { BlockToolbar } from "../blocks/block-toolbar";
import { useBlockEditor } from "../blocks/use-block-editor";
import { useMediaBlocks } from "../blocks/use-media-blocks";
import { OverflowMenu } from "../overflow-menu";
import { StatusStepper } from "./status-stepper";
import { useIsDesktop } from "../../lib/use-responsive";
import { TagChip } from "../tag-chip";
import { SegmentedControl } from "../tasks/segmented-control";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-screen text-ink-3 mb-2 mt-7 pl-[22px] font-mono text-[10px] font-semibold tracking-[0.14em]">
      {children}
    </Text>
  );
}

/**
 * The idea editor body — driven by an `id` (not the route params) so it works both as the standalone
 * `/idea/[id]` route and as the right-hand pane in the desktop master-detail Ideas screen. `onClose`
 * is what the back button / post-archive-drop-delete flow calls (router.back on the route, clear the
 * selection in the split). Renders no SafeAreaView / Sidebar — the caller owns the frame.
 */
export function IdeaEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const priorityColor: Record<Idea["priority"], string> = {
    low: c.ink3,
    medium: c.medium,
    high: c.high,
    critical: c.critical,
  };

  const { data: ideas = [] } = useIdeas();
  const idea = useMemo(() => ideas.find((i) => i.id === id), [ideas, id]);

  const updateIdea = useUpdateIdea();
  const setStatus = useSetIdeaStatus();
  const archive = useArchiveIdea();
  const del = useDeleteIdea();
  const patch = (p: Partial<IdeaInput>) => idea && updateIdea.mutate({ id: idea.id, patch: p });

  const [title, setTitle] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (idea) setTitle(idea.title);
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

  const addTag = () => {
    const name = tagDraft.trim().replace(/^#/, "").toLowerCase();
    if (name && !idea.tags.includes(name)) patch({ tags: [...idea.tags, name] });
    setTagDraft("");
  };
  const removeTag = (t: string) => patch({ tags: idea.tags.filter((x) => x !== t) });

  return (
    <View className="flex-1">
      {/* maxWidth is a no-op on phones (< 680pt) and keeps the editor a readable column on desktop */}
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingBottom: 110, maxWidth: 680, width: "100%", alignSelf: "center", ...(isDesktop ? { paddingTop: 20 } : null) }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {/* Nav */}
        <View className="px-screen flex-row items-center justify-between pt-2">
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Go back" className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} accessibilityLabel="More options" className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <MoreHorizontal size={20} color={c.ink2} strokeWidth={1.7} />
          </Pressable>
        </View>

        {/* Title */}
        <View className="px-screen mt-[22px]">
          <AutoGrowInput
            value={title}
            onChangeText={setTitle}
            onBlur={() => {
              const t = title.trim();
              if (t && t !== idea.title) patch({ title: t });
              else if (!t) setTitle(idea.title);
            }}
            placeholder="Idea title"
            placeholderTextColor={c.ink3}
            minHeight={30}
            className="text-ink text-[24px] font-bold leading-[30px] tracking-[-0.02em]"
          />

          {/* Tags */}
          <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
            {idea.tags.map((t) => (
              <Pressable key={t} onPress={() => removeTag(t)}>
                <TagChip tag={t} tinted />
              </Pressable>
            ))}
            {addingTag ? (
              <View className="border-line rounded-[7px] border border-dashed px-2.5 py-1.5">
                <TextInput
                  autoFocus
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  onSubmitEditing={addTag}
                  onBlur={() => {
                    addTag();
                    setAddingTag(false);
                  }}
                  placeholder="tag"
                  placeholderTextColor={c.ink3}
                  submitBehavior="submit"
                  className="text-ink min-w-[48px] font-mono text-[11px]"
                />
              </View>
            ) : (
              <Pressable
                onPress={() => setAddingTag(true)}
                className="border-line flex-row items-center gap-1 rounded-[7px] border border-dashed px-2.5 py-1.5"
              >
                <Plus size={11} color={c.ink3} strokeWidth={2} />
                <Text className="text-ink-3 font-mono text-[11px]">tag</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Status */}
        <SectionLabel>STATUS</SectionLabel>
        <View className="px-screen">
          <StatusStepper status={idea.status} onSelect={(status) => setStatus.mutate({ id: idea.id, status })} />
        </View>

        {/* Priority */}
        <SectionLabel>PRIORITY</SectionLabel>
        <View className="px-screen">
          <SegmentedControl
            value={idea.priority}
            onChange={(priority) => patch({ priority })}
            options={priorityLevels.map((p) => ({ value: p, label: cap(p), color: priorityColor[p] }))}
          />
        </View>

        {/* Writing canvas — the idea's free-flow body (controls above, document below). flex-1 lets it
            absorb spare height (paired with the ScrollView's flexGrow) so the meta line below always
            clears the floating toolbar instead of hiding under it when the idea is short. */}
        <View className="mx-screen border-line mt-7 border-t" />
        <View className="px-screen mt-5 flex-1" style={{ minHeight: 360 }}>
          <BlockList
            blocks={editor.blocks}
            setText={editor.setText}
            removeBlock={editor.removeBlock}
            firstPlaceholder="Write freely — add headings, links, photos, or a voice note from the bar below."
          />
        </View>

        {/* Meta */}
        <Text className="text-ink-3 mt-[18px] text-center font-mono text-[10.5px] leading-[17px]">
          created {shortDate(idea.created_at).toLowerCase()} · updated {relativeFromNow(idea.updated_at)}
        </Text>
      </ScrollView>

      <BlockToolbar
        onAddHeading={editor.addHeading}
        onAddParagraph={editor.addParagraph}
        onAddLink={editor.addLink}
        onAddImage={media.addImage}
        onRecordComplete={media.addAudio}
      />

      <OverflowMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            label: "Archive",
            onPress: () => {
              archive.mutate({ id: idea.id, isArchived: true });
              onClose();
            },
          },
          {
            label: "Drop idea",
            onPress: () => {
              setStatus.mutate({ id: idea.id, status: "dropped" });
              onClose();
            },
          },
          {
            label: "Delete",
            destructive: true,
            onPress: () => {
              del.mutate(idea.id);
              onClose();
            },
          },
        ]}
      />
    </View>
  );
}
