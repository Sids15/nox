import { useCreateIdea, useIdeas, useThemeColors } from "@nox/features";
import type { Idea } from "@nox/types";
import { useRouter } from "expo-router";
import { Lightbulb, Search, SlidersHorizontal } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fab, useHideOnScroll } from "../../components/fab";
import { DesktopHeader } from "../../components/desktop-header";
import { EmptyState } from "../../components/empty-state";
import { ListSkeleton } from "../../components/skeleton";
import { ProfileAvatar } from "../../components/profile-avatar";
import { IdeaCard } from "../../components/ideas/idea-card";
import { IdeaEditor } from "../../components/ideas/idea-editor";
import { useIsDesktop } from "../../lib/use-responsive";
import {
  DEFAULT_IDEA_FILTERS,
  IdeaFilters,
  type IdeaFiltersState,
} from "../../components/ideas/idea-filters";

function matchesSearch(idea: Idea, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    idea.title.toLowerCase().includes(needle) ||
    (idea.description?.toLowerCase().includes(needle) ?? false) ||
    idea.tags.some((t) => t.toLowerCase().includes(needle))
  );
}

export default function IdeasScreen() {
  const fab = useHideOnScroll();
  const router = useRouter();
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<IdeaFiltersState>(DEFAULT_IDEA_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  // Desktop master-detail: the idea currently open in the right-hand editor pane.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtersActive = filters.status !== "all" || filters.priority !== "all";

  const { data: ideas = [], isLoading, isError, refetch } = useIdeas();
  const createIdea = useCreateIdea();
  const isFiltering = !!search || filters.status !== "all" || filters.priority !== "all";

  const visible = useMemo(
    () =>
      ideas.filter(
        (i) =>
          !i.is_archived &&
          i.status !== "dropped" &&
          (filters.status === "all" || i.status === filters.status) &&
          (filters.priority === "all" || i.priority === filters.priority) &&
          matchesSearch(i, search),
      ),
    [ideas, filters.status, filters.priority, search],
  );

  // Desktop: open in the editor pane (no navigation). Mobile: push the standalone route.
  const openIdea = (id: string) => {
    if (isDesktop) setSelectedId(id);
    else router.push(`/idea/${id}`);
  };
  const onCreate = () => {
    const id = createIdea.create({
      title: "Untitled idea",
      description: null,
      content: [],
      priority: "medium",
      status: "raw",
      tags: [],
    });
    openIdea(id);
  };

  const selectedIdea = selectedId ? ideas.find((i) => i.id === selectedId) : undefined;
  // Split view only once an idea is actually open; otherwise the grid keeps the full canvas.
  const detailOpen = isDesktop && !!selectedIdea;

  const list = (
    <ScrollView
        onScroll={fab.onScroll}
        scrollEventThrottle={16}
       
      className="flex-1"
      contentContainerStyle={{
        paddingBottom: 150,
        ...(isDesktop
          ? detailOpen
            ? { paddingHorizontal: 12, paddingTop: 24 }
            : { paddingHorizontal: 10, paddingTop: 28, maxWidth: 1020, width: "100%", alignSelf: "center" }
          : null),
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {/* Header — desktop: 26px title + "New idea" pill; mobile: 30px title + filter toggle */}
      {isDesktop ? (
        <DesktopHeader
          eyebrow={`${ideas.filter((i) => !i.is_archived && i.status !== "dropped").length} IDEAS`}
          title="Ideas"
          actionLabel="New idea"
          onAction={onCreate}
        />
      ) : (
        <View className="px-screen flex-row items-start justify-between pt-2">
          <View>
            <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">
              {ideas.filter((i) => !i.is_archived && i.status !== "dropped").length} IDEAS
            </Text>
            <Text className="text-ink mt-2 text-[30px] font-bold leading-[33px] tracking-[-0.02em]">
              Ideas
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setFiltersOpen((v) => !v)}
              accessibilityLabel="Toggle filters"
              className={`rounded-pill h-[34px] w-[34px] items-center justify-center ${filtersOpen || filtersActive ? "bg-accent-soft" : "bg-chip"}`}
            >
              <SlidersHorizontal size={16} color={filtersOpen || filtersActive ? c.accent : c.ink2} strokeWidth={1.8} />
            </Pressable>
            <ProfileAvatar />
          </View>
        </View>
      )}

      {/* Search (mobile — desktop uses the sidebar's ⌘K) */}
      {!isDesktop && (
        <View className="px-screen mt-5">
          <View className="bg-chip rounded-input h-11 flex-row items-center gap-[10px] px-[13px]">
            <Search size={15} color={c.ink3} strokeWidth={1.8} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search ideas…"
              placeholderTextColor={c.ink3}
              className="text-ink flex-1 text-[14.5px]"
              style={{ paddingVertical: 0 }}
            />
          </View>
        </View>
      )}

      {/* Filters (always on desktop; collapsed behind the header toggle on mobile) */}
      {(isDesktop || filtersOpen) && (
        <View className="mt-3.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            <IdeaFilters filters={filters} onChange={setFilters} />
          </ScrollView>
        </View>
      )}

      {/* List */}
      <View className="px-screen mt-4 gap-[10px]">
        {isError && ideas.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Couldn't load your ideas"
            subtitle="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => refetch()}
          />
        ) : isLoading && ideas.length === 0 ? (
          <ListSkeleton />
        ) : visible.length === 0 ? (
          isFiltering ? (
            <EmptyState icon={Search} title="No ideas match" subtitle="Try a different search or filter." />
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="Capture your first idea"
              subtitle="Jot a spark, then grow it with notes, links, and voice — right here."
              actionLabel="New idea"
              onAction={onCreate}
            />
          )
        ) : isDesktop && !detailOpen ? (
          // 3 columns at the 1020 canvas ≈ the handoff's ~330px card width — cards read full, not barren.
          <View className="flex-row gap-3">
            {[0, 1, 2].map((ci) => (
              <View key={ci} className="flex-1 gap-3">
                {visible.filter((_, i) => i % 3 === ci).map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} onPress={() => openIdea(idea.id)} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          // Single column: mobile, or the desktop master list when the editor pane is open.
          visible.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              selected={idea.id === selectedId}
              onPress={() => openIdea(idea.id)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );

  // Desktop: master-detail — the idea list on the left, the editor pane on the right.
  if (detailOpen) {
    return (
      <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
        <View className="flex-1 flex-row">
          <View className="border-line w-[400px] border-r">{list}</View>
          <View className="flex-1">
            <IdeaEditor key={selectedId} id={selectedId!} onClose={() => setSelectedId(null)} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Mobile, or desktop with nothing selected (full-width grid).
  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      {list}

      {/* FAB (mobile; desktop creates from the header +) */}
      {!isDesktop && (
        <Fab onPress={onCreate} label="New idea" bottom={112} visible={fab.visible} />
      )}
    </SafeAreaView>
  );
}
