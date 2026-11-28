import {
  inboxItems,
  useDeleteIdea,
  useDeleteNote,
  useDeleteResource,
  useDeleteTask,
  useSpaces,
  useThemeColors,
  useUpdateIdea,
  useUpdateNote,
  useUpdateResource,
  useUpdateTask,
  type InboxItem,
} from "@nox/features";
import { addDays, relativeFromNow, todayKey } from "@nox/utils";
import { Check, ChevronLeft, Inbox as InboxIcon, Layers, Trash2 } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KindIcon } from "../components/brain/kind-icon";
import { openRef, usePages } from "../components/brain/pages";
import { SpaceMark } from "../components/brain/space-mark";
import { MenuRow, pressScale, TABULAR } from "../components/menu";
import { Popover } from "../components/popover";
import { goBack } from "../lib/go-back";
import { useIsDesktop } from "../lib/use-responsive";

/**
 * The Inbox: what you captured from outside (share sheet, widgets, "Add to Nox") without a home.
 * Give each a day or a space, keep it as it is, or delete it — about a second per item.
 */
export default function InboxScreen() {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const pages = usePages();
  const items = useMemo(() => inboxItems(pages), [pages]);

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120, ...(isDesktop ? { paddingTop: 16 } : null) }}>
        <View className="px-screen" style={{ maxWidth: 760, width: "100%", alignSelf: "center" }}>
          <View className="flex-row items-center gap-2 pt-2">
            <Pressable
              onPress={() => goBack("/tasks")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={pressScale}
              className="hover:bg-chip -ml-2 h-[34px] w-[34px] items-center justify-center rounded-[10px]"
            >
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <Text className="text-ink flex-1 font-serif text-[30px] font-bold tracking-[-0.01em]">Inbox</Text>
            {items.length > 0 ? (
              <Text style={TABULAR} className="text-ink-3 text-[15px] font-medium">
                {items.length}
              </Text>
            ) : null}
          </View>
          <Text className="text-ink-3 mb-4 mt-1 text-[14px] leading-[20px]">
            What you saved from the share sheet and widgets. Give each a day or a space, or keep it as it is.
          </Text>

          {items.length === 0 ? (
            <View className="items-center py-16">
              <View className="bg-chip mb-3 h-12 w-12 items-center justify-center rounded-full">
                <InboxIcon size={22} color={c.ink3} strokeWidth={2} />
              </View>
              <Text className="text-ink text-[16px] font-semibold">All sorted</Text>
              <Text className="text-ink-3 mt-1 text-center text-[14px]">Share a link or a thought to Nox and it lands here.</Text>
            </View>
          ) : (
            items.map((item) => <InboxRow key={`${item.kind}:${item.id}`} item={item} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const c = useThemeColors();
  const pages = usePages();
  const { data: allSpaces = [] } = useSpaces();
  const spaces = allSpaces.filter((s) => !s.archived);
  const updateTask = useUpdateTask();
  const updateNote = useUpdateNote();
  const updateIdea = useUpdateIdea();
  const updateResource = useUpdateResource();
  const delTask = useDeleteTask();
  const delNote = useDeleteNote();
  const delIdea = useDeleteIdea();
  const delResource = useDeleteResource();
  const [spaceOpen, setSpaceOpen] = useState(false);
  const spaceRef = useRef<View>(null);
  const today = todayKey();

  // Every action ends with the item out of the Inbox (the update hooks clear the mark on a day or space).
  const patch = (p: { space_id?: string; due_date?: string; inbox?: boolean }) => {
    if (item.kind === "task") updateTask.mutate({ id: item.id, patch: p });
    else if (item.kind === "note") updateNote.mutate({ id: item.id, patch: p });
    else if (item.kind === "idea") updateIdea.mutate({ id: item.id, patch: p });
    else updateResource.mutate({ id: item.id, patch: p });
  };
  const remove = () => {
    if (item.kind === "task") delTask.mutate(item.id);
    else if (item.kind === "note") delNote.mutate(item.id);
    else if (item.kind === "idea") delIdea.mutate(item.id);
    else delResource.mutate(item.id);
  };

  const chip = (label: string, onPress: () => void, icon?: React.ReactNode) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${item.title}`}
      style={pressScale}
      className="bg-chip hover:opacity-80 h-[28px] flex-row items-center gap-1.5 rounded-[8px] px-2.5"
    >
      {icon}
      <Text className="text-ink-2 text-[13px] font-medium">{label}</Text>
    </Pressable>
  );

  return (
    <View className="border-line border-b py-3">
      <Pressable
        onPress={() => openRef({ kind: item.kind, id: item.id }, item.kind === "resource" ? pages.resource(item.id) : undefined)}
        accessibilityRole="link"
        className="flex-row items-center gap-3"
      >
        <View style={{ width: 18, alignItems: "center" }}>
          <KindIcon kind={item.kind} color={c.ink3} size={16} />
        </View>
        <Text numberOfLines={2} className="text-ink flex-1 text-[15px]">
          {item.title}
        </Text>
        <Text className="text-ink-3 text-[12px]">{relativeFromNow(item.created_at)}</Text>
      </Pressable>
      <View className="ml-[30px] mt-2 flex-row flex-wrap items-center gap-1.5">
        {item.kind === "task" ? (
          <>
            {chip("Today", () => patch({ due_date: today }))}
            {chip("Tomorrow", () => patch({ due_date: addDays(today, 1) }))}
          </>
        ) : null}
        {spaces.length > 0 ? (
          <View ref={spaceRef} collapsable={false}>
            {chip("Space", () => setSpaceOpen(true), <Layers size={13} color={c.ink2} strokeWidth={2} />)}
          </View>
        ) : null}
        {chip("Keep", () => patch({ inbox: false }), <Check size={13} color={c.ink2} strokeWidth={2.2} />)}
        <View className="flex-1" />
        <Pressable onPress={remove} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} className="hover:bg-chip h-[28px] w-[28px] items-center justify-center rounded-[8px]">
          <Trash2 size={14} color={c.ink3} strokeWidth={2} />
        </Pressable>
      </View>
      <Popover anchorRef={spaceRef} open={spaceOpen} onClose={() => setSpaceOpen(false)} width={240} accessibilityLabel="Move to a space">
        <View className="p-1.5">
          {spaces.map((s) => (
            <MenuRow
              key={s.id}
              label={s.name}
              icon={<SpaceMark space={s} size={18} />}
              onPress={() => {
                setSpaceOpen(false);
                patch({ space_id: s.id });
              }}
            />
          ))}
        </View>
      </Popover>
    </View>
  );
}
