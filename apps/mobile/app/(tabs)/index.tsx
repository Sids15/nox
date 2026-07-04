import { useCreateIdea, useIdeas, useThemeColors } from "@nox/features";
import type { Idea } from "@nox/types";
import { useRouter } from "expo-router";
import { Plus, Search, SlidersHorizontal } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileAvatar } from "../../components/profile-avatar";
import { IdeaCard } from "../../components/ideas/idea-card";
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
  const router = useRouter();
  const c = useThemeColors();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<IdeaFiltersState>(DEFAULT_IDEA_FILTERS);

  const { data: ideas = [], isLoading } = useIdeas();
  const createIdea = useCreateIdea();

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

  const onCreate = () => {
    const id = createIdea.create({
      title: "Untitled idea",
      description: null,
      content: [],
      priority: "medium",
      status: "raw",
      tags: [],
    });
    router.push(`/idea/${id}`);
  };

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-screen flex-row items-start justify-between pt-2">
          <View>
            <Text className="text-ink-3 font-mono text-[10.5px] font-medium tracking-[0.14em]">
              {ideas.filter((i) => !i.is_archived && i.status !== "dropped").length} IDEAS
            </Text>
            <Text className="text-ink mt-[3px] text-[30px] font-bold leading-[33px] tracking-[-0.02em]">
              Ideas
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
              <SlidersHorizontal size={16} color={c.ink2} strokeWidth={1.8} />
            </Pressable>
            <ProfileAvatar />
          </View>
        </View>

        {/* Search */}
        <View className="px-screen mt-[14px]">
          <View className="bg-chip rounded-input h-10 flex-row items-center gap-[10px] px-[13px]">
            <Search size={15} color={c.ink3} strokeWidth={1.8} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search ideas…"
              placeholderTextColor={c.ink3}
              className="text-ink flex-1 text-[14.5px]"
            />
          </View>
        </View>

        {/* Filters */}
        <View className="mt-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            <IdeaFilters filters={filters} onChange={setFilters} />
          </ScrollView>
        </View>

        {/* List */}
        <View className="px-screen mt-4 gap-[10px]">
          {isLoading && ideas.length === 0 ? (
            <View className="mt-16 items-center">
              <ActivityIndicator color={c.accent} />
            </View>
          ) : visible.length === 0 ? (
            <Text className="text-ink-3 mt-10 text-center text-[14px]">
              {search || filters.status !== "all" || filters.priority !== "all"
                ? "No ideas match."
                : "No ideas yet — tap + to capture one."}
            </Text>
          ) : (
            visible.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} onPress={() => router.push(`/idea/${idea.id}`)} />
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="New idea"
        className="bg-accent rounded-fab absolute h-[54px] w-[54px] items-center justify-center"
        style={{
          right: 20,
          bottom: 112,
          shadowColor: c.accent,
          shadowOpacity: 0.4,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
        }}
      >
        <Plus size={22} color={c.onAccent} strokeWidth={2.2} />
      </Pressable>
    </SafeAreaView>
  );
}
