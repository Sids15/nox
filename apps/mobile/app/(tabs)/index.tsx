import { useCreateIdea, useIdeas, useSetIdeaStatus, useThemeColors } from "@nox/features";
import type { Idea } from "@nox/types";
import { capitalize } from "@nox/utils";
import { useRouter } from "expo-router";
import { Lightbulb, ListFilter, Plus, Search, X } from "lucide-react-native";
import { Fragment, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type GestureResponderEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../components/empty-state";
import { Fab, useHideOnScroll } from "../../components/fab";
import { IdeaCard } from "../../components/ideas/idea-card";
import { IdeaEditor } from "../../components/ideas/idea-editor";
import { MenuDivider, MenuLabel, MenuRow, pressScale, TABULAR } from "../../components/menu";
import { Popover } from "../../components/popover";
import { ProfileAvatar } from "../../components/profile-avatar";
import { ListSkeleton } from "../../components/skeleton";
import { plural } from "../../lib/confirm";
import { useIsDesktop } from "../../lib/use-responsive";

type Stage = "raw" | "exploring" | "validating" | "complete";
const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "raw", label: "Raw", hint: "Just caught" },
  { key: "exploring", label: "Exploring", hint: "Thinking it through" },
  { key: "validating", label: "Validating", hint: "Testing it" },
  { key: "complete", label: "Complete", hint: "Done or shipped" },
];

type Show = "active" | "dropped" | "archived";
const WEB_GRAB = Platform.OS === "web" ? ({ cursor: "grab", userSelect: "none" } as object) : null;
type PriorityFilter = "all" | Idea["priority"];

function matchesSearch(idea: Idea, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const body = idea.content.map((b) => ("text" in b ? b.text : "")).join(" ");
  return (
    idea.title.toLowerCase().includes(needle) ||
    (idea.description?.toLowerCase().includes(needle) ?? false) ||
    body.toLowerCase().includes(needle) ||
    idea.tags.some((t) => t.toLowerCase().includes(needle))
  );
}

/**
 * Ideas as a pipeline. An idea moves Raw → Exploring → Validating → Complete, so that is how the page
 * is laid out: four columns on desktop (a board, like Linear's or Trello's), the same four as
 * sections on phones and beside an open idea. Dropped and archived ideas are one filter away instead
 * of hidden for good. Search covers titles, bodies and tags.
 */
export default function IdeasScreen() {
  const fab = useHideOnScroll();
  const router = useRouter();
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("active");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<View>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: ideas = [], isLoading, isError, refetch } = useIdeas();
  const createIdea = useCreateIdea();

  const visible = useMemo(
    () =>
      ideas.filter((i) => {
        const inShow =
          show === "archived" ? i.is_archived : show === "dropped" ? !i.is_archived && i.status === "dropped" : !i.is_archived && i.status !== "dropped";
        return inShow && (priority === "all" || i.priority === priority) && matchesSearch(i, search);
      }),
    [ideas, show, priority, search],
  );
  const byStage = useMemo(() => {
    const m = new Map<Stage, Idea[]>(STAGES.map((s) => [s.key, []]));
    for (const i of visible) m.get(i.status as Stage)?.push(i);
    const rank: Record<Idea["priority"], number> = { critical: 0, high: 1, medium: 2, low: 3 };
    for (const list of m.values()) list.sort((a, b) => rank[a.priority] - rank[b.priority] || b.updated_at.localeCompare(a.updated_at));
    return m;
  }, [visible]);

  const activeCount = ideas.filter((i) => !i.is_archived && i.status !== "dropped").length;
  const exploring = ideas.filter((i) => !i.is_archived && i.status === "exploring").length;
  const filtersActive = show !== "active" || priority !== "all";
  const stageTint: Record<Stage, string> = { raw: c.ink3, exploring: c.info, validating: c.success, complete: c.accent };

  const openIdea = (id: string) => {
    if (isDesktop) setSelectedId(id);
    else router.push(`/idea/${id}`);
  };
  const onCreate = (status: Stage = "raw") => {
    const id = createIdea.create({ title: "Untitled idea", description: null, content: [], priority: "medium", status, tags: [] });
    openIdea(id);
  };
  // Catch an idea without leaving the board: type, Enter, it lands in Raw.
  const [capture, setCapture] = useState("");
  const [caught, setCaught] = useState<string | null>(null);
  const quickCapture = () => {
    const title = capture.trim().slice(0, 200);
    if (!title) return;
    createIdea.create({ title, description: null, content: [], priority: "medium", status: "raw", tags: [] });
    setCapture("");
    setCaught(title);
    setTimeout(() => setCaught(null), 2500);
  };

  // ── Drag a card to another column (desktop board) ──
  const setStatus = useSetIdeaStatus();
  const boardRef = useRef<View>(null);
  const boardRect = useRef<{ x: number; y: number; width: number } | null>(null);
  const gesture = useRef<{ idea: Idea; x0: number; y0: number; moved: boolean } | null>(null);
  const [drag, setDrag] = useState<{ idea: Idea; x: number; y: number; to: Stage | null } | null>(null);
  const stageAt = (x: number): Stage | null => {
    const r = boardRect.current;
    if (!r || x < r.x || x > r.x + r.width) return null;
    return STAGES[Math.min(STAGES.length - 1, Math.floor(((x - r.x) / r.width) * STAGES.length))]!.key;
  };
  const dragHandlers = (idea: Idea) => ({
    onStartShouldSetResponder: () => true,
    onResponderTerminationRequest: () => !gesture.current?.moved,
    onResponderGrant: (e: GestureResponderEvent) => {
      gesture.current = { idea, x0: e.nativeEvent.pageX, y0: e.nativeEvent.pageY, moved: false };
      boardRef.current?.measureInWindow((x, y, width) => (boardRect.current = { x, y, width }));
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const g = gesture.current;
      if (!g) return;
      const { pageX: x, pageY: y } = e.nativeEvent;
      if (!g.moved && Math.hypot(x - g.x0, y - g.y0) < 6) return;
      g.moved = true;
      setDrag({ idea: g.idea, x, y, to: stageAt(x) });
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const g = gesture.current;
      gesture.current = null;
      setDrag(null);
      if (!g) return;
      if (!g.moved) return openIdea(g.idea.id);
      const to = stageAt(e.nativeEvent.pageX);
      if (to && to !== g.idea.status) setStatus.mutate({ id: g.idea.id, status: to });
    },
    onResponderTerminate: () => {
      gesture.current = null;
      setDrag(null);
    },
  });

  const selectedIdea = selectedId ? ideas.find((i) => i.id === selectedId) : undefined;
  const detailOpen = isDesktop && !!selectedIdea;
  const board = isDesktop && !detailOpen && show === "active";

  const header = (
    <View className="px-screen pt-2">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-ink font-serif text-[30px] font-bold leading-[36px] tracking-[-0.01em]">
            {show === "active" ? "Ideas" : show === "dropped" ? "Dropped ideas" : "Archived ideas"}
          </Text>
          <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[13.5px] font-medium">
            {show === "active"
              ? `${plural(activeCount, "idea")}${exploring ? ` · ${exploring} exploring` : ""}`
              : plural(visible.length, "idea")}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5 pt-1">
          <View ref={filterRef} collapsable={false}>
            <Pressable
              onPress={() => setFilterOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="Filters"
              accessibilityState={{ expanded: filterOpen }}
              style={pressScale}
              className={`h-[34px] w-[34px] items-center justify-center rounded-[10px] ${filterOpen || filtersActive ? "bg-accent/[0.14]" : "hover:bg-chip"}`}
            >
              <ListFilter size={17} color={filterOpen || filtersActive ? c.accent : c.ink2} strokeWidth={2} />
            </Pressable>
          </View>
          {isDesktop ? (
            <Pressable
              onPress={() => onCreate()}
              accessibilityRole="button"
              accessibilityLabel="New idea"
              style={pressScale}
              className="bg-accent hover:opacity-90 h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-3.5"
            >
              <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
              <Text className="text-on-accent text-[13.5px] font-semibold">New idea</Text>
            </Pressable>
          ) : (
            <ProfileAvatar />
          )}
        </View>
      </View>

      <Popover anchorRef={filterRef} open={filterOpen} onClose={() => setFilterOpen(false)} width={240} accessibilityLabel="Filters">
        <View className="p-1.5">
          <MenuLabel>Show</MenuLabel>
          <MenuRow label="Active ideas" selected={show === "active"} onPress={() => setShow("active")} />
          <MenuRow label="Dropped" selected={show === "dropped"} onPress={() => setShow("dropped")} />
          <MenuRow label="Archived" selected={show === "archived"} onPress={() => setShow("archived")} />
          <MenuDivider />
          <MenuLabel>Priority</MenuLabel>
          <MenuRow label="Any priority" selected={priority === "all"} onPress={() => setPriority("all")} />
          {(["critical", "high", "medium", "low"] as const).map((p) => (
            <MenuRow key={p} label={capitalize(p)} selected={priority === p} onPress={() => setPriority(p)} />
          ))}
        </View>
      </Popover>

      {/* Search */}
      <View className="bg-surface border-line mt-4 h-[42px] flex-row items-center gap-2.5 rounded-[11px] border px-3">
        <Search size={15} color={c.ink3} strokeWidth={2} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search ideas, notes inside them, tags…"
          placeholderTextColor={c.ink3}
          accessibilityLabel="Search ideas"
          className="text-ink flex-1 text-[14.5px]"
          style={{ paddingVertical: 0, outlineWidth: 0 } as object}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <X size={15} color={c.ink3} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {show === "active" && (
        <View className="mt-2.5 flex-row items-center gap-2.5 px-1">
          <Lightbulb size={15} color={capture.trim() ? c.accent : c.ink3} strokeWidth={2} />
          <TextInput
            value={capture}
            onChangeText={setCapture}
            onSubmitEditing={quickCapture}
            submitBehavior="submit"
            placeholder="Catch an idea: type it and press Enter"
            placeholderTextColor={c.ink3}
            accessibilityLabel="Catch an idea"
            maxLength={200}
            className="text-ink flex-1 text-[14.5px]"
            style={{ paddingVertical: 6, outlineWidth: 0 } as object}
          />
          {caught ? (
            <Text numberOfLines={1} className="text-success max-w-[200px] text-[12.5px] font-semibold">
              Added to Raw
            </Text>
          ) : capture.trim() ? (
            <Pressable onPress={quickCapture} accessibilityRole="button" style={pressScale} className="bg-accent h-7 justify-center rounded-[8px] px-2.5">
              <Text className="text-on-accent text-[12.5px] font-semibold">Add</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {filtersActive && (
        <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
          {show !== "active" && (
            <View className="bg-accent/[0.12] rounded-pill px-2.5 py-1">
              <Text className="text-accent text-[12px] font-semibold">{capitalize(show)}</Text>
            </View>
          )}
          {priority !== "all" && (
            <View className="bg-accent/[0.12] rounded-pill px-2.5 py-1">
              <Text className="text-accent text-[12px] font-semibold">{capitalize(priority)} priority</Text>
            </View>
          )}
          <Pressable
            onPress={() => {
              setShow("active");
              setPriority("all");
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            className="hover:bg-chip h-6 w-6 items-center justify-center rounded-full"
          >
            <X size={13} color={c.ink3} strokeWidth={2.4} />
          </Pressable>
        </View>
      )}
    </View>
  );

  const stageTitle = (s: (typeof STAGES)[number], count: number) => (
    <View className="mb-2.5 flex-row items-center gap-2 pl-0.5">
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: stageTint[s.key] }} />
      <Text className="text-ink text-[13.5px] font-bold">{s.label}</Text>
      <Text style={TABULAR} className="text-ink-3 text-[13px] font-semibold">
        {count}
      </Text>
    </View>
  );

  let body;
  if (isError && ideas.length === 0) {
    body = (
      <EmptyState icon={Lightbulb} title="Couldn't load your ideas" subtitle="Check your connection and try again." actionLabel="Try again" onAction={() => refetch()} />
    );
  } else if (isLoading && ideas.length === 0) {
    body = <ListSkeleton />;
  } else if (activeCount === 0 && show === "active" && !search && priority === "all") {
    body = (
      <EmptyState
        icon={Lightbulb}
        title="Catch your first idea"
        subtitle="Jot down a spark, then grow it with notes, links and voice as it moves from raw to done."
        actionLabel="New idea"
        onAction={() => onCreate()}
      />
    );
  } else if (visible.length === 0) {
    body = (
      <View className="items-center py-14">
        <Text className="text-ink text-[15px] font-semibold">
          {search ? "No ideas match" : show === "dropped" ? "Nothing dropped" : show === "archived" ? "Nothing archived" : "No ideas here"}
        </Text>
        <Text className="text-ink-3 mt-1 text-center text-[13px]">
          {search ? "Try different words, or clear the filters." : "Ideas you drop or archive land here, and can be brought back."}
        </Text>
      </View>
    );
  } else if (board) {
    // Desktop board: one column per stage. Drag a card to another column to move it on.
    body = (
      <View ref={boardRef} collapsable={false} className="flex-row gap-3.5">
        {STAGES.map((s) => {
          const list = byStage.get(s.key) ?? [];
          const hot = drag?.to === s.key && drag.idea.status !== s.key;
          return (
            <View key={s.key} className={`min-w-0 flex-1 rounded-[14px] ${hot ? "bg-accent/[0.06]" : ""}`} style={{ minHeight: 320 }}>
              <View className="flex-row items-center">
                <View className="flex-1">{stageTitle(s, list.length)}</View>
                <Pressable
                  onPress={() => onCreate(s.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`New idea in ${s.label}`}
                  className="hover:bg-chip -mt-2.5 h-7 w-7 items-center justify-center rounded-[8px]"
                >
                  <Plus size={14} color={c.ink3} strokeWidth={2.2} />
                </Pressable>
              </View>
              <View className="gap-2.5">
                {list.map((idea) => (
                  <View
                    key={idea.id}
                    {...dragHandlers(idea)}
                    style={[{ opacity: drag?.idea.id === idea.id ? 0.35 : 1 }, WEB_GRAB]}
                    accessibilityRole="button"
                    accessibilityLabel={`${idea.title}. Drag to another stage, or open.`}
                    // Keyboard: Tab to a card, Enter or Space opens it (the drag handlers need a pointer).
                    {...(Platform.OS === "web"
                      ? ({
                          tabIndex: 0,
                          onKeyDown: (e: { key: string; preventDefault: () => void }) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openIdea(idea.id);
                            }
                          },
                        } as object)
                      : null)}
                  >
                    <View pointerEvents="box-only">
                      <IdeaCard idea={idea} showStatus={false} onPress={() => {}} />
                    </View>
                  </View>
                ))}
                {list.length === 0 && (
                  <View className={`items-center rounded-[14px] border border-dashed px-3 py-6 ${hot ? "border-accent" : "border-line"}`}>
                    <Text className="text-ink-3 text-[12.5px]">{hot ? `Move to ${s.label}` : s.hint}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  } else if (show === "active") {
    // Sections by stage (phones, and beside an open idea on desktop).
    body = (
      <View>
        {STAGES.map((s) => {
          const list = byStage.get(s.key) ?? [];
          if (list.length === 0) return null;
          return (
            <View key={s.key} className="mb-6">
              {stageTitle(s, list.length)}
              <View className="gap-2.5">
                {list.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} showStatus={false} selected={idea.id === selectedId} onPress={() => openIdea(idea.id)} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    );
  } else {
    body = (
      <View className="gap-2.5">
        {visible.map((idea) => (
          <Fragment key={idea.id}>
            <IdeaCard idea={idea} selected={idea.id === selectedId} onPress={() => openIdea(idea.id)} />
          </Fragment>
        ))}
      </View>
    );
  }

  const list = (
    <ScrollView
      onScroll={fab.onScroll}
      scrollEventThrottle={16}
      className="flex-1"
      contentContainerStyle={{
        paddingBottom: 150,
        ...(isDesktop
          ? detailOpen
            ? { paddingHorizontal: 4, paddingTop: 24 }
            : { paddingHorizontal: 10, paddingTop: 28, maxWidth: 1160, width: "100%", alignSelf: "center" }
          : null),
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {header}
      <View className="px-screen mt-6">{body}</View>
    </ScrollView>
  );

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

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      {list}
      {!isDesktop && <Fab onPress={() => onCreate()} label="New idea" bottom={112} visible={fab.visible} />}
      {drag && (
        <View
          pointerEvents="none"
          className="bg-ink absolute flex-row items-center gap-2 rounded-[9px] px-2.5 py-1.5"
          // Page coordinates: pinned to the window on the web (the pane starts after the sidebar).
          style={{ left: drag.x + 12, top: drag.y + 8, maxWidth: 280, ...(Platform.OS === "web" ? ({ position: "fixed" } as object) : null) }}
        >
          <Text numberOfLines={1} className="text-bg text-[12.5px] font-semibold">
            {drag.idea.title}
          </Text>
          <Text className="text-bg text-[12px] opacity-70">→ {drag.to ? STAGES.find((x) => x.key === drag.to)!.label : "—"}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
