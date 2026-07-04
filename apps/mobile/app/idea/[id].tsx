import {
  useArchiveIdea,
  useIdeas,
  useSetIdeaStatus,
  useThemeColors,
  useUpdateIdea,
} from "@nox/features";
import { priorityLevels, type ContentBlock, type Idea, type IdeaInput } from "@nox/types";
import { relativeFromNow, shortDate } from "@nox/utils";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MoreHorizontal, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlockList } from "../../components/blocks/block-list";
import { BlockToolbar } from "../../components/blocks/block-toolbar";
import { useBlockEditor } from "../../components/blocks/use-block-editor";
import { StatusStepper } from "../../components/ideas/status-stepper";
import { TagChip } from "../../components/tag-chip";
import { SegmentedControl } from "../../components/tasks/segmented-control";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-screen text-ink-3 mb-2 mt-7 pl-[22px] font-mono text-[10px] font-semibold tracking-[0.14em]">
      {children}
    </Text>
  );
}

export default function IdeaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const c = useThemeColors();
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
  const patch = (p: Partial<IdeaInput>) => idea && updateIdea.mutate({ id: idea.id, patch: p });

  const [title, setTitle] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [addingTag, setAddingTag] = useState(false);

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

  const goBack = () => router.back();

  if (!idea) {
    return (
      <SafeAreaView className="bg-bg flex-1">
        <View className="px-screen pt-2">
          <Pressable onPress={goBack} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink-2 mt-8 text-[15px]">Idea not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const addTag = () => {
    const name = tagDraft.trim().replace(/^#/, "").toLowerCase();
    if (name && !idea.tags.includes(name)) patch({ tags: [...idea.tags, name] });
    setTagDraft("");
  };
  const removeTag = (t: string) => patch({ tags: idea.tags.filter((x) => x !== t) });

  return (
    <SafeAreaView className="bg-bg flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 110 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {/* Nav */}
        <View className="px-screen flex-row items-center justify-between pt-2">
          <Pressable onPress={goBack} hitSlop={8} accessibilityLabel="Go back" className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Pressable hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
            <MoreHorizontal size={20} color={c.ink2} strokeWidth={1.7} />
          </Pressable>
        </View>

        {/* Title */}
        <View className="px-screen mt-[22px]">
          <TextInput
            value={title}
            onChangeText={setTitle}
            onBlur={() => {
              const t = title.trim();
              if (t && t !== idea.title) patch({ title: t });
              else if (!t) setTitle(idea.title);
            }}
            multiline
            placeholder="Idea title"
            placeholderTextColor={c.ink3}
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

        {/* Free-flow details */}
        <SectionLabel>DETAILS</SectionLabel>
        <View className="px-screen mt-1">
          <BlockList
            blocks={editor.blocks}
            setText={editor.setText}
            removeBlock={editor.removeBlock}
            firstPlaceholder="Add details, links, media…"
          />
        </View>

        {/* Meta */}
        <Text className="text-ink-3 mt-[18px] text-center font-mono text-[10.5px] leading-[17px]">
          created {shortDate(idea.created_at).toLowerCase()} · updated {relativeFromNow(idea.updated_at)}
        </Text>

        {/* Archive / Drop */}
        <View className="px-screen mt-[14px] flex-row gap-[10px]">
          <Pressable
            onPress={() => {
              archive.mutate({ id: idea.id, isArchived: true });
              goBack();
            }}
            className="bg-chip flex-1 items-center rounded-[14px] py-[13px]"
          >
            <Text className="text-ink-2 text-[14px] font-semibold">Archive</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setStatus.mutate({ id: idea.id, status: "dropped" });
              goBack();
            }}
            className="bg-high/[0.09] flex-1 items-center rounded-[14px] py-[13px]"
          >
            <Text className="text-high text-[14px] font-semibold">Drop idea</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BlockToolbar
        onAddHeading={editor.addHeading}
        onAddParagraph={editor.addParagraph}
        onAddLink={editor.addLink}
      />
    </SafeAreaView>
  );
}
