import { usePrefs, useSpaces, useThemeColors } from "@nox/features";
import type { Space } from "@nox/types";
import { relativeFromNow } from "@nox/utils";
import { useRouter } from "expo-router";
import { CircleHelp, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NewSpaceDialog } from "../../components/brain/new-space-dialog";
import { usePages } from "../../components/brain/pages";
import { SpaceMark } from "../../components/brain/space-mark";
import { SPACE_PRESETS, type SpacePreset } from "../../components/brain/space-presets";
import { SpacesIntro } from "../../components/brain/spaces-intro";
import { pressScale, TABULAR } from "../../components/menu";
import { ProfileAvatar } from "../../components/profile-avatar";
import { ListSkeleton } from "../../components/skeleton";
import { plural } from "../../lib/confirm";
import { useIsDesktop } from "../../lib/use-responsive";

interface SpaceStats {
  pages: number;
  tasks: number;
  /** Pages in each stage, in pipeline order. */
  perStage: number[];
  lastActive: string | null;
}

/**
 * Spaces: one per area of work or life (a YouTube channel, a project, your PRDs). Each holds its own
 * notes, ideas, tasks and resources and has its own pipeline board. The first visit walks through
 * how they work; "?" brings that back.
 */
export default function SpacesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { data: spaces = [], isLoading } = useSpaces();
  const pages = usePages();
  const introSeen = usePrefs((s) => s.spacesIntroSeen);
  const setIntroSeen = usePrefs((s) => s.setSpacesIntroSeen);
  const [intro, setIntro] = useState(false);
  const [creating, setCreating] = useState<{ preset?: SpacePreset } | null>(null);

  // First visit: the walkthrough, once per device.
  useEffect(() => {
    if (!introSeen && !isLoading) setIntro(true);
  }, [introSeen, isLoading]);
  const closeIntro = () => {
    setIntro(false);
    if (!introSeen) setIntroSeen(true);
  };

  const stats = useMemo(() => {
    const m = new Map<string, SpaceStats>();
    for (const s of spaces) m.set(s.id, { pages: 0, tasks: 0, perStage: s.stages.map(() => 0), lastActive: null });
    const touch = (e: SpaceStats, at: string) => {
      if (!e.lastActive || at > e.lastActive) e.lastActive = at;
    };
    for (const n of [...pages.notes.filter((x) => !x.is_archived), ...pages.ideas.filter((x) => !x.is_archived && x.status !== "dropped")]) {
      const e = n.space_id ? m.get(n.space_id) : undefined;
      if (!e) continue;
      e.pages++;
      touch(e, n.updated_at);
      const space = spaces.find((s) => s.id === n.space_id)!;
      const i = n.stage ? space.stages.indexOf(n.stage) : -1;
      if (i >= 0) e.perStage[i]!++;
    }
    for (const t of pages.tasks) {
      const e = t.space_id ? m.get(t.space_id) : undefined;
      if (!e || t.status === "complete" || t.deleted) continue;
      e.tasks++;
      touch(e, t.updated_at);
    }
    return m;
  }, [spaces, pages]);

  const card = (s: Space) => {
    const st = stats.get(s.id) ?? { pages: 0, tasks: 0, perStage: [], lastActive: null };
    const total = st.perStage.reduce((a, b) => a + b, 0);
    return (
      <Pressable
        key={s.id}
        onPress={() => router.push(`/space/${s.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`${s.name}, ${plural(st.pages, "page")}, ${st.tasks} open tasks`}
        style={pressScale}
        className="border-line bg-surface hover:border-accent/[0.35] overflow-hidden rounded-card border"
      >
        <View className="p-4">
          <View className="flex-row items-center gap-3">
            <SpaceMark space={s} size={42} />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-ink text-[17px] font-semibold tracking-[-0.01em]">
                {s.name}
              </Text>
              <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[13px]">
                {plural(st.pages, "page")} · {st.tasks} open {st.tasks === 1 ? "task" : "tasks"}
              </Text>
            </View>
          </View>

          {s.stages.length > 0 ? (
            <View className="mt-4">
              {/* Where the space's work sits: one segment per stage, sized by how much is in it. */}
              <View className="bg-chip h-[6px] flex-row overflow-hidden rounded-full">
                {total > 0
                  ? st.perStage.map((n, i) =>
                      n > 0 ? <View key={i} style={{ flex: n, backgroundColor: c.accent, opacity: 0.35 + (0.65 * (i + 1)) / s.stages.length }} /> : null,
                    )
                  : null}
              </View>
              <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1">
                {s.stages.slice(0, 6).map((name, i) => (
                  <Text key={name} style={TABULAR} className="text-ink-3 text-[12px]">
                    {name} <Text className="text-ink-2 font-semibold">{st.perStage[i] ?? 0}</Text>
                  </Text>
                ))}
              </View>
            </View>
          ) : (
            <Text className="text-ink-3 mt-4 text-[12px]">No pipeline · notes, ideas, tasks and links</Text>
          )}

          <Text className="text-ink-3 mt-3 text-[12px]">{st.lastActive ? `Active ${relativeFromNow(st.lastActive)}` : "Nothing in it yet"}</Text>
        </View>
      </Pressable>
    );
  };

  const header = (
    <View className="px-screen flex-row items-start justify-between pt-2">
      <View className="flex-1 pr-3">
        <Text className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">Spaces</Text>
        <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[14px] font-medium">
          {spaces.length ? plural(spaces.length, "space") : "Your second brain, by area"}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5 pt-1">
        <Pressable onPress={() => setIntro(true)} accessibilityRole="button" accessibilityLabel="How Spaces work" style={pressScale} className="hover:bg-chip h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-2">
          <CircleHelp size={17} color={c.ink2} strokeWidth={2} />
          {isDesktop ? <Text className="text-ink-2 text-[13px] font-medium">How it works</Text> : null}
        </Pressable>
        {isDesktop ? (
          <Pressable onPress={() => setCreating({})} accessibilityRole="button" style={pressScale} className="bg-accent hover:opacity-90 h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-3.5">
            <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
            <Text className="text-on-accent text-[14px] font-semibold">New space</Text>
          </Pressable>
        ) : (
          <>
            <Pressable onPress={() => setCreating({})} accessibilityRole="button" accessibilityLabel="New space" style={pressScale} className="bg-accent h-[34px] w-[34px] items-center justify-center rounded-[10px]">
              <Plus size={17} color={c.onAccent} strokeWidth={2.4} />
            </Pressable>
            <ProfileAvatar />
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 150, ...(isDesktop ? { paddingTop: 20 } : null) }} showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        <View className="bg-bg pb-2">{header}</View>

        {isLoading ? (
          <View className="px-screen mt-5">
            <ListSkeleton />
          </View>
        ) : spaces.length === 0 ? (
          /* Empty: start from a kind in one tap, instead of a blank form. */
          <View className="px-screen mt-6">
            <Text className="text-ink text-[16px] font-semibold">Start with a space</Text>
            <Text className="text-ink-3 mb-3 mt-1 text-[14px] leading-[20px]">Pick what it's for. You can rename it and change its stages any time.</Text>
            <View className="gap-2.5" style={isDesktop ? { flexDirection: "row", flexWrap: "wrap" } : undefined}>
              {SPACE_PRESETS.map((p) => (
                // Equal columns: four across on a wide screen, wrapping two by two when narrower.
                <View key={p.key} style={isDesktop ? { flexGrow: 1, flexBasis: 0, minWidth: 210 } : undefined}>
                <Pressable
                  onPress={() => setCreating({ preset: p })}
                  accessibilityRole="button"
                  style={pressScale}
                  className="border-line bg-surface hover:border-accent/[0.4] rounded-card h-full border p-4"
                >
                  <SpaceMark space={{ icon: p.icon }} size={34} />
                  <Text className="text-ink mt-2 text-[15px] font-semibold">{p.label}</Text>
                  <Text numberOfLines={2} className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">
                    {p.stages.length ? p.stages.join(" → ") : p.hint}
                  </Text>
                </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View className="px-screen mt-5 gap-3" style={isDesktop ? { flexDirection: "row", flexWrap: "wrap" } : undefined}>
            {spaces.map((s) => (
              <View key={s.id} style={isDesktop ? { width: 320 } : undefined}>
                {card(s)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <NewSpaceDialog visible={!!creating} initialPreset={creating?.preset} onClose={() => setCreating(null)} />
      <SpacesIntro visible={intro} onClose={closeIntro} onCreate={spaces.length === 0 ? () => setCreating({}) : undefined} />
    </SafeAreaView>
  );
}
