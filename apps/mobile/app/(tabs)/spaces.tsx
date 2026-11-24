import { useSpaces, useThemeColors } from "@nox/features";
import type { Space } from "@nox/types";
import { useRouter } from "expo-router";
import { Layers, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NewSpaceDialog } from "../../components/brain/new-space-dialog";
import { usePages } from "../../components/brain/pages";
import { SpaceMark } from "../../components/brain/space-mark";
import { DesktopHeader } from "../../components/desktop-header";
import { EmptyState } from "../../components/empty-state";
import { Fab } from "../../components/fab";
import { pressScale, TABULAR } from "../../components/menu";
import { ProfileAvatar } from "../../components/profile-avatar";
import { ListSkeleton } from "../../components/skeleton";
import { plural } from "../../lib/confirm";
import { useIsDesktop } from "../../lib/use-responsive";

/**
 * Spaces: one per area of work or life (a YouTube channel, a project, your PRDs). Each holds its own
 * notes, ideas, tasks and resources and has its own pipeline board. Pages can live in one space.
 */
export default function SpacesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { data: spaces = [], isLoading } = useSpaces();
  const { pages } = usePages();
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, { pages: number; tasks: number }>();
    for (const p of pages) {
      if (!p.space_id || p.done) continue;
      const e = m.get(p.space_id) ?? { pages: 0, tasks: 0 };
      if (p.kind === "task") e.tasks++;
      else e.pages++;
      m.set(p.space_id, e);
    }
    return m;
  }, [pages]);

  const card = (s: Space) => {
    const n = counts.get(s.id) ?? { pages: 0, tasks: 0 };
    return (
      <Pressable
        key={s.id}
        onPress={() => router.push(`/space/${s.id}`)}
        accessibilityRole="link"
        accessibilityLabel={s.name}
        style={pressScale}
        className="border-line bg-surface hover:border-accent/[0.4] rounded-card border p-4"
      >
        <View className="flex-row items-center gap-3">
          <SpaceMark space={s} size={34} />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-ink text-[16px] font-semibold">
              {s.name}
            </Text>
            <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[13px]">
              {plural(n.pages, "page")} · {n.tasks} open {n.tasks === 1 ? "task" : "tasks"}
            </Text>
          </View>
        </View>
        {s.stages.length > 0 ? (
          <Text numberOfLines={1} className="text-ink-3 mt-3 text-[12px]">
            {s.stages.join(" → ")}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 150, ...(isDesktop ? { paddingTop: 20 } : null) }} showsVerticalScrollIndicator={false}>
        {isDesktop ? (
          <DesktopHeader title="Spaces" eyebrow={plural(spaces.length, "space")} actionLabel="New space" onAction={() => setCreating(true)} />
        ) : (
          <View className="px-screen flex-row items-start justify-between pt-2">
            <View className="flex-1 pr-3">
              <Text className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">Spaces</Text>
              <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[14px] font-medium">
                {plural(spaces.length, "space")}
              </Text>
            </View>
            <View className="pt-1">
              <ProfileAvatar />
            </View>
          </View>
        )}

        {isLoading ? (
          <View className="px-screen mt-5">
            <ListSkeleton />
          </View>
        ) : spaces.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Give each part of your life a space"
            subtitle="A YouTube channel, a project, your PRDs: each space keeps its own notes, ideas, tasks and links, with a board for its pipeline."
            actionLabel="Make your first space"
            onAction={() => setCreating(true)}
          />
        ) : (
          <View className="px-screen mt-5 gap-3" style={isDesktop ? { flexDirection: "row", flexWrap: "wrap" } : undefined}>
            {spaces.map((s) => (
              <View key={s.id} style={isDesktop ? { width: 300 } : undefined}>
                {card(s)}
              </View>
            ))}
            <Pressable
              onPress={() => setCreating(true)}
              accessibilityRole="button"
              className="border-line hover:bg-chip rounded-card flex-row items-center justify-center gap-2 border border-dashed p-4"
              style={isDesktop ? { width: 300 } : undefined}
            >
              <Plus size={16} color={c.ink3} strokeWidth={2.2} />
              <Text className="text-ink-3 text-[14px] font-medium">New space</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      {!isDesktop && spaces.length > 0 ? <Fab onPress={() => setCreating(true)} label="New space" bottom={112} /> : null}
      <NewSpaceDialog visible={creating} onClose={() => setCreating(false)} />
    </SafeAreaView>
  );
}
