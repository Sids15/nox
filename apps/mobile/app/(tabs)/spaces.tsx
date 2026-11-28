import { useSpaces, useThemeColors } from "@nox/features";
import type { Space } from "@nox/types";
import { capitalize, relativeDayLabel, relativeFromNow, todayKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { Circle, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NewSpaceDialog } from "../../components/brain/new-space-dialog";
import { usePages } from "../../components/brain/pages";
import { SpaceMark } from "../../components/brain/space-mark";
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
  /** The next thing to do: the open task due soonest (undated ones after), or null. */
  next: { title: string; due: string | null } | null;
}

/**
 * Spaces: one per area of work or life (a YouTube channel, a project, your PRDs). Each holds its own
 * tasks, notes and links; a board is optional.
 */
export default function SpacesScreen() {
  const c = useThemeColors();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { data: spaces = [], isLoading } = useSpaces();
  const pages = usePages();
  const [creating, setCreating] = useState(false);
  const today = todayKey();

  const stats = useMemo(() => {
    const m = new Map<string, SpaceStats>();
    for (const s of spaces) m.set(s.id, { pages: 0, tasks: 0, perStage: s.stages.map(() => 0), lastActive: null, next: null });
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
      if (!e || t.status === "complete" || t.deleted || (t.repeat !== "none" && t.origin_task_id === null)) continue;
      e.tasks++;
      touch(e, t.updated_at);
      const due = t.due_date ?? null;
      const n = e.next;
      if (!n || (due && (!n.due || due < n.due))) e.next = { title: t.title, due };
    }
    return m;
  }, [spaces, pages]);

  const card = (s: Space) => {
    const st = stats.get(s.id) ?? { pages: 0, tasks: 0, perStage: [], lastActive: null, next: null };
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
          ) : null}

          {/* What's next here, so the Spaces page reads like a dashboard. */}
          <View className="border-line mt-4 border-t pt-3">
            {st.next ? (
              <View className="flex-row items-center gap-2">
                <Circle size={13} color={c.ink3} strokeWidth={2} />
                <Text numberOfLines={1} className="text-ink-2 flex-1 text-[13px]">
                  {st.next.title}
                </Text>
                {st.next.due ? (
                  <Text style={TABULAR} className={`text-[12px] font-medium ${st.next.due < today ? "text-high" : "text-ink-3"}`}>
                    {capitalize(relativeDayLabel(st.next.due, today))}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text className="text-ink-3 text-[12px]">{st.lastActive ? `Nothing to do · active ${relativeFromNow(st.lastActive)}` : "Nothing in it yet"}</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const header = (
    <View className="px-screen flex-row items-start justify-between pt-2">
      <View className="flex-1 pr-3">
        <Text className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">Spaces</Text>
        <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[14px] font-medium">
          {spaces.length ? plural(spaces.length, "space") : "One place per project"}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5 pt-1">
        {isDesktop ? (
          <Pressable onPress={() => setCreating(true)} accessibilityRole="button" style={pressScale} className="bg-accent hover:opacity-90 h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-3.5">
            <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
            <Text className="text-on-accent text-[14px] font-semibold">New space</Text>
          </Pressable>
        ) : (
          <>
            <Pressable onPress={() => setCreating(true)} accessibilityRole="button" accessibilityLabel="New space" style={pressScale} className="bg-accent h-[34px] w-[34px] items-center justify-center rounded-[10px]">
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
          /* Empty: one sentence and one button. */
          <View className="px-screen mt-10 items-center">
            <SpaceMark space={{ icon: "layers" }} size={52} />
            <Text className="text-ink mt-4 text-center text-[17px] font-semibold">Keep each project in one place</Text>
            <Text className="text-ink-3 mt-1.5 max-w-[420px] text-center text-[14px] leading-[20px]">
              A space holds the tasks, notes and links for one thing — a YouTube channel, a launch, a class. Add to it straight from its page.
            </Text>
            <Pressable onPress={() => setCreating(true)} accessibilityRole="button" style={pressScale} className="bg-accent hover:opacity-90 mt-5 h-[40px] flex-row items-center gap-1.5 rounded-[11px] px-4">
              <Plus size={16} color={c.onAccent} strokeWidth={2.4} />
              <Text className="text-on-accent text-[14px] font-semibold">New space</Text>
            </Pressable>
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
      <NewSpaceDialog visible={creating} onClose={() => setCreating(false)} />
    </SafeAreaView>
  );
}
