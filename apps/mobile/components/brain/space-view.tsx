import { useDeleteSpace, useThemeColors, useUpdateSpace } from "@nox/features";
import type { Space } from "@nox/types";
import { ChevronLeft, CircleHelp, Kanban, Link2, MoreHorizontal, SquareCheckBig, Table2, Trash2, Waypoints } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { confirmDelete, plural } from "../../lib/confirm";
import { goBack } from "../../lib/go-back";
import { useIsDesktop } from "../../lib/use-responsive";
import { MenuDivider, MenuRow, pressScale, TABULAR } from "../menu";
import { Popover } from "../popover";
import { usePages } from "./pages";
import { SpaceBoard } from "./space-board";
import { SpaceMark } from "./space-mark";
import { GettingStarted, NewInSpace, ResourceList, TaskList, type SpacePage } from "./space-parts";
import { SPACE_EMOJI } from "./space-presets";
import { SpaceTable } from "./space-table";
import { SpacesIntro } from "./spaces-intro";
import { StageEditor } from "./stage-editor";

type SpaceTab = "board" | "table" | "tasks" | "resources";

/**
 * One space, Notion-style: its pages as a Board (by stage) or a Table (by field), plus its tasks and
 * saved links. Everything here is also in the normal tabs; the space is a focused view of it.
 */
export function SpaceView({ space }: { space: Space }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const pages = usePages();
  const updateSpace = useUpdateSpace();
  const del = useDeleteSpace();
  const [view, setView] = useState<SpaceTab>(space.stages.length ? "board" : "table");
  const [name, setName] = useState(space.name);
  const [menu, setMenu] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [intro, setIntro] = useState(false);
  const menuRef = useRef<View>(null);
  const markRef = useRef<View>(null);

  useEffect(() => setName(space.name), [space.id, space.name]);
  useEffect(() => {
    if (view === "board" && space.stages.length === 0) setView("table");
  }, [space.stages.length, view]);

  const spacePages = useMemo<SpacePage[]>(
    () =>
      [
        ...pages.notes
          .filter((n) => n.space_id === space.id && !n.is_archived)
          .map((n) => ({ ...pages.find({ kind: "note", id: n.id })!, stage: n.stage, properties: n.properties, tags: n.tags })),
        ...pages.ideas
          .filter((i) => i.space_id === space.id && !i.is_archived && i.status !== "dropped")
          .map((i) => ({ ...pages.find({ kind: "idea", id: i.id })!, stage: i.stage, properties: i.properties, tags: i.tags })),
      ].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [pages, space.id],
  );
  const tasks = useMemo(() => pages.tasks.filter((t) => t.space_id === space.id && !t.deleted && !(t.repeat !== "none" && t.origin_task_id === null)), [pages.tasks, space.id]);
  const resources = useMemo(() => pages.resources.filter((r) => r.space_id === space.id && !r.is_archived), [pages.resources, space.id]);
  const openTasks = tasks.filter((t) => t.status !== "complete").length;
  const empty = spacePages.length === 0 && tasks.length === 0 && resources.length === 0;

  const commitName = () => {
    const n = name.trim().slice(0, 80);
    if (n && n !== space.name) updateSpace.mutate({ id: space.id, patch: { name: n } });
    else setName(space.name);
  };

  const views: { key: SpaceTab; label: string; Icon: typeof Kanban; count?: number }[] = [
    ...(space.stages.length ? [{ key: "board" as const, label: "Board", Icon: Kanban, count: spacePages.length }] : []),
    { key: "table", label: "Table", Icon: Table2, count: space.stages.length ? undefined : spacePages.length },
    { key: "tasks", label: "Tasks", Icon: SquareCheckBig, count: openTasks },
    { key: "resources", label: "Resources", Icon: Link2, count: resources.length },
  ];

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140, ...(isDesktop ? { paddingTop: 16 } : null) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* One header line: back · mark + name + counts · menu */}
        <View className="px-screen flex-row items-center gap-3 pt-2">
          <Pressable onPress={() => goBack("/spaces")} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back to spaces" style={pressScale} className="hover:bg-chip -ml-2 h-[34px] w-[34px] items-center justify-center rounded-[10px]">
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <View ref={markRef} collapsable={false}>
            <Pressable onPress={() => setMarkOpen(true)} accessibilityRole="button" accessibilityLabel="Change mark" style={pressScale}>
              <SpaceMark space={space} size={36} />
            </Pressable>
          </View>
          <View className="min-w-0 flex-1">
            <TextInput
              value={name}
              onChangeText={setName}
              onBlur={commitName}
              onSubmitEditing={commitName}
              maxLength={80}
              accessibilityLabel="Space name"
              className="text-ink font-serif text-[24px] font-bold tracking-[-0.01em]"
              style={{ paddingVertical: 0 }}
            />
            <Text style={TABULAR} numberOfLines={1} className="text-ink-3 text-[12px] font-medium">
              {plural(spacePages.length, "page")} · {openTasks} open {openTasks === 1 ? "task" : "tasks"} · {plural(resources.length, "link")}
            </Text>
          </View>
          <View ref={menuRef} collapsable={false}>
            <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Space options" style={pressScale} className="hover:bg-chip h-[34px] w-[34px] items-center justify-center rounded-[10px]">
              <MoreHorizontal size={19} color={c.ink2} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* Views, like a Notion database's, and New */}
        <View className="px-screen mt-5 flex-row items-center gap-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }} style={{ flexGrow: 1, flexShrink: 1 }}>
            {views.map(({ key, label, Icon, count }) => {
              const on = view === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setView(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  className={`h-[32px] flex-row items-center gap-1.5 rounded-[9px] px-2.5 ${on ? "bg-surface border-line border" : "hover:bg-chip"}`}
                  style={on ? { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : undefined}
                >
                  <Icon size={14} color={on ? c.accent : c.ink3} strokeWidth={2} />
                  <Text className={`text-[13px] ${on ? "text-ink font-semibold" : "text-ink-2 font-medium"}`}>{label}</Text>
                  {count ? (
                    <Text style={TABULAR} className="text-ink-3 text-[12px]">
                      {count}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <NewInSpace space={space} stage={space.stages[0] ?? null} />
        </View>

        <View className="mt-4">
          {empty && (view === "board" || view === "table") ? (
            <GettingStarted space={space} onStages={() => setStagesOpen(true)} onHelp={() => setIntro(true)} />
          ) : view === "board" ? (
            <SpaceBoard space={space} pages={spacePages} />
          ) : view === "table" ? (
            <SpaceTable space={space} pages={spacePages} />
          ) : view === "tasks" ? (
            <TaskList spaceId={space.id} tasks={tasks} />
          ) : (
            <ResourceList spaceId={space.id} resources={resources} />
          )}
        </View>
      </ScrollView>

      <Popover anchorRef={menuRef} open={menu} onClose={() => setMenu(false)} width={230} accessibilityLabel="Space options">
        <View className="p-1.5">
          <MenuRow label={space.stages.length ? "Edit pipeline stages" : "Add a pipeline board"} icon={<Waypoints size={15} color={c.ink2} strokeWidth={2} />} onPress={() => { setMenu(false); setStagesOpen(true); }} />
          <MenuRow label="How Spaces work" icon={<CircleHelp size={15} color={c.ink2} strokeWidth={2} />} onPress={() => { setMenu(false); setIntro(true); }} />
          <MenuDivider />
          <MenuRow
            label="Delete space"
            danger
            icon={<Trash2 size={15} color={c.high} strokeWidth={2} />}
            onPress={() => {
              setMenu(false);
              confirmDelete({
                title: "Delete space?",
                message: `“${space.name}” will be deleted on all your devices. Its notes, ideas, tasks and resources are kept, just no longer in a space.`,
                onConfirm: () => {
                  del.mutate(space.id);
                  goBack("/spaces");
                },
              });
            }}
          />
        </View>
      </Popover>
      <Popover anchorRef={markRef} open={markOpen} onClose={() => setMarkOpen(false)} width={236} accessibilityLabel="Mark">
        <View className="flex-row flex-wrap gap-1 p-2">
          {SPACE_EMOJI.map((e) => (
            <Pressable key={e} onPress={() => { setMarkOpen(false); updateSpace.mutate({ id: space.id, patch: { icon: e } }); }} className={`h-9 w-9 items-center justify-center rounded-[9px] ${space.icon === e ? "bg-accent/[0.16]" : "hover:bg-chip"}`}>
              <Text style={{ fontSize: 18 }}>{e}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => { setMarkOpen(false); updateSpace.mutate({ id: space.id, patch: { icon: "" } }); }} className="hover:bg-chip h-9 items-center justify-center rounded-[9px] px-2">
            <Text className="text-ink-2 text-[13px]">Letter</Text>
          </Pressable>
        </View>
      </Popover>
      <StageEditor space={space} visible={stagesOpen} onClose={() => setStagesOpen(false)} />
      <SpacesIntro visible={intro} onClose={() => setIntro(false)} />
    </View>
  );
}
