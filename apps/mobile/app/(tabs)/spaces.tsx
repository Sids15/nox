import { useSpaces, useThemeColors } from "@nox/features";
import type { Space } from "@nox/types";
import { addDays, capitalize, relativeDayLabel, todayKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronRight, Circle, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NewSpaceDialog } from "../../components/brain/new-space-dialog";
import { usePages } from "../../components/brain/pages";
import { deadlineLabel, SpaceProgress } from "../../components/brain/space-goal";
import { SpaceMark } from "../../components/brain/space-mark";
import { pressScale, TABULAR } from "../../components/menu";
import { ProfileAvatar } from "../../components/profile-avatar";
import { ListSkeleton } from "../../components/skeleton";
import { plural } from "../../lib/confirm";
import { useIsDesktop } from "../../lib/use-responsive";

interface SpaceStats {
  pages: number;
  tasks: number;
  /** Tasks done, ever (for the progress bar). */
  done: number;
  /** The next thing to do: the open task due soonest (undated ones after), or null. */
  next: { title: string; due: string | null } | null;
  /** The last 7 days and the next 7: done, added, due soon, overdue. */
  week: { done: number; added: number; dueSoon: number; overdue: number };
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
  const inAWeek = addDays(today, 7);
  // Midnight a week ago, as an ISO timestamp to compare with created_at / updated_at.
  const weekAgo = useMemo(() => new Date(`${addDays(today, -7)}T00:00:00`).toISOString(), [today]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const active = spaces.filter((s) => !s.archived);
  const archived = spaces.filter((s) => s.archived);

  const stats = useMemo(() => {
    const m = new Map<string, SpaceStats>();
    for (const s of spaces) m.set(s.id, { pages: 0, tasks: 0, done: 0, next: null, week: { done: 0, added: 0, dueSoon: 0, overdue: 0 } });
    for (const n of [...pages.notes.filter((x) => !x.is_archived), ...pages.ideas.filter((x) => !x.is_archived && x.status !== "dropped")]) {
      const e = n.space_id ? m.get(n.space_id) : undefined;
      if (!e) continue;
      e.pages++;
      if (n.created_at >= weekAgo) e.week.added++;
    }
    for (const t of pages.tasks) {
      const e = t.space_id ? m.get(t.space_id) : undefined;
      if (!e || t.deleted || (t.repeat !== "none" && t.origin_task_id === null)) continue;
      if (t.created_at >= weekAgo) e.week.added++;
      if (t.status === "complete") {
        e.done++;
        if (t.updated_at >= weekAgo) e.week.done++;
        continue;
      }
      if (t.due_date && t.due_date < today) e.week.overdue++;
      else if (t.due_date && t.due_date <= inAWeek) e.week.dueSoon++;
      e.tasks++;
      const due = t.due_date ?? null;
      const n = e.next;
      if (!n || (due && (!n.due || due < n.due))) e.next = { title: t.title, due };
    }
    return m;
  }, [spaces, pages, today, weekAgo, inAWeek]);

  const review = active
    .map((s) => ({ s, w: stats.get(s.id)?.week ?? { done: 0, added: 0, dueSoon: 0, overdue: 0 } }))
    .filter(({ w }) => w.done + w.added + w.dueSoon + w.overdue > 0);
  const totals = review.reduce((a, { w }) => ({ done: a.done + w.done, added: a.added + w.added, overdue: a.overdue + w.overdue }), { done: 0, added: 0, overdue: 0 });

  const card = (s: Space) => {
    const st = stats.get(s.id) ?? { pages: 0, tasks: 0, done: 0, next: null, week: { done: 0, added: 0, dueSoon: 0, overdue: 0 } };
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

          {s.description || s.due_date ? (
            <View className="mt-3 flex-row items-center gap-1.5">
              {s.description ? (
                <Text numberOfLines={1} className="text-ink-2 flex-shrink text-[13px]">
                  {s.description}
                </Text>
              ) : null}
              {s.due_date ? (() => {
                const d = deadlineLabel(s.due_date, today);
                return (
                  <Text style={TABULAR} numberOfLines={1} className={`text-[12px] font-medium ${d.late ? "text-high" : "text-ink-3"}`}>
                    {s.description ? "· " : ""}{d.text}
                  </Text>
                );
              })() : null}
            </View>
          ) : null}
          {st.done + st.tasks > 0 ? (
            <View className="mt-3">
              <SpaceProgress done={st.done} total={st.done + st.tasks} compact />
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
              <Text className="text-ink-3 text-[12px]">{st.pages + st.tasks > 0 ? "Nothing to do" : "Nothing in it yet"}</Text>
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
          {active.length ? plural(active.length, "space") : "One place per project"}
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
          <>
            {review.length > 0 ? (
              <View className="px-screen mt-4">
                {/* The weekly review: what moved in each space, what's stuck, what's coming. */}
                <Pressable onPress={() => setReviewOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: reviewOpen }} className="border-line bg-surface hover:border-ink-3 rounded-card border px-4 py-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-ink flex-1 text-[14px] font-semibold">This week</Text>
                    <Text style={TABULAR} className="text-ink-3 text-[13px]">
                      {totals.done} done · {totals.added} added{totals.overdue ? ` · ${totals.overdue} overdue` : ""}
                    </Text>
                    {reviewOpen ? <ChevronDown size={14} color={c.ink3} strokeWidth={2.2} /> : <ChevronRight size={14} color={c.ink3} strokeWidth={2.2} />}
                  </View>
                  {reviewOpen ? (
                    <View className="mt-2.5 gap-2">
                      {review.map(({ s, w }) => (
                        <Pressable key={s.id} onPress={() => router.push(`/space/${s.id}`)} accessibilityRole="link" className="flex-row items-center gap-2.5">
                          <SpaceMark space={s} size={22} />
                          <Text numberOfLines={1} className="text-ink-2 flex-1 text-[13px] font-medium">
                            {s.name}
                          </Text>
                          <Text style={TABULAR} className="text-ink-3 text-[12px]">
                            {[w.done && `${w.done} done`, w.added && `${w.added} added`, w.dueSoon && `${w.dueSoon} due soon`].filter(Boolean).join(" · ")}
                            {w.overdue ? <Text className="text-high">{`${w.done || w.added || w.dueSoon ? " · " : ""}${w.overdue} overdue`}</Text> : null}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              </View>
            ) : null}
            <View className="px-screen mt-5 gap-3" style={isDesktop ? { flexDirection: "row", flexWrap: "wrap" } : undefined}>
              {active.map((s) => (
                <View key={s.id} style={isDesktop ? { width: 320 } : undefined}>
                  {card(s)}
                </View>
              ))}
            </View>
            {archived.length > 0 ? (
              <View className="px-screen mt-6">
                <Pressable onPress={() => setShowArchived((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showArchived }} className="flex-row items-center gap-1.5 self-start py-1">
                  {showArchived ? <ChevronDown size={14} color={c.ink3} strokeWidth={2.2} /> : <ChevronRight size={14} color={c.ink3} strokeWidth={2.2} />}
                  <Text style={TABULAR} className="text-ink-3 text-[13px] font-medium">
                    Archived · {archived.length}
                  </Text>
                </Pressable>
                {showArchived ? (
                  <View className="mt-2 gap-3" style={[{ opacity: 0.75 }, isDesktop ? { flexDirection: "row", flexWrap: "wrap" } : null]}>
                    {archived.map((s) => (
                      <View key={s.id} style={isDesktop ? { width: 320 } : undefined}>
                        {card(s)}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <NewSpaceDialog visible={creating} onClose={() => setCreating(false)} />
    </SafeAreaView>
  );
}
