import {
  useCreateIdea,
  useCreateNote,
  useCreateResource,
  useCreateTask,
  useDeleteSpace,
  useThemeColors,
  useToggleTask,
  useUpdateIdea,
  useUpdateNote,
  useUpdateSpace,
  type Ref,
} from "@nox/features";
import type { Space } from "@nox/types";
import { domainFrom, relativeFromNow } from "@nox/utils";
import { router } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  FileText,
  Kanban,
  Lightbulb,
  Link2,
  List,
  MoreHorizontal,
  Plus,
  SquareCheckBig,
  Trash2,
  Waypoints,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { confirmDelete, plural } from "../../lib/confirm";
import { goBack } from "../../lib/go-back";
import { toHttpUrl } from "../../lib/open-external";
import { useIsDesktop } from "../../lib/use-responsive";
import { MenuDivider, MenuLabel, MenuRow, pressScale, TABULAR } from "../menu";
import { Popover } from "../popover";
import { KindIcon } from "./kind-icon";
import { openRef, usePages, type Page } from "./pages";
import { SpaceMark } from "./space-mark";
import { SPACE_EMOJI } from "./space-presets";
import { StageEditor } from "./stage-editor";
import { useAllTemplates } from "./template-starter";
import { fromTemplate, type TemplateLike } from "./templates";

type Tab = "board" | "pages" | "tasks" | "resources";
const NO_STAGE = "\u0000none";

/** A page that can sit on the board (notes and ideas carry a stage). */
interface BoardPage extends Page {
  stage: string | null;
}

/**
 * One space: its pipeline board, its pages (notes and ideas), its tasks and its resources, and the
 * controls to add to each. Everything here is also in the normal tabs; the space is a filtered,
 * focused view with a board on top.
 */
export function SpaceView({ space }: { space: Space }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const pages = usePages();
  const updateSpace = useUpdateSpace();
  const del = useDeleteSpace();
  const [tab, setTab] = useState<Tab>(space.stages.length ? "board" : "pages");
  const [name, setName] = useState(space.name);
  const [menu, setMenu] = useState(false);
  const [markOpen, setMarkOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const menuRef = useRef<View>(null);
  const markRef = useRef<View>(null);

  useEffect(() => setName(space.name), [space.id, space.name]);
  useEffect(() => {
    if (tab === "board" && space.stages.length === 0) setTab("pages");
  }, [space.stages.length, tab]);

  const boardPages = useMemo<BoardPage[]>(
    () => [
      ...pages.notes.filter((n) => n.space_id === space.id && !n.is_archived).map((n) => ({ ...pages.find({ kind: "note", id: n.id })!, stage: n.stage })),
      ...pages.ideas
        .filter((i) => i.space_id === space.id && !i.is_archived && i.status !== "dropped")
        .map((i) => ({ ...pages.find({ kind: "idea", id: i.id })!, stage: i.stage })),
    ].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [pages, space.id],
  );
  const tasks = useMemo(() => pages.tasks.filter((t) => t.space_id === space.id && !t.deleted && !(t.repeat !== "none" && t.origin_task_id === null)), [pages.tasks, space.id]);
  const resources = useMemo(() => pages.resources.filter((r) => r.space_id === space.id && !r.is_archived), [pages.resources, space.id]);
  const openTasks = tasks.filter((t) => t.status !== "complete").length;

  const commitName = () => {
    const n = name.trim().slice(0, 80);
    if (n && n !== space.name) updateSpace.mutate({ id: space.id, patch: { name: n } });
    else setName(space.name);
  };

  const tabs: { key: Tab; label: string; Icon: typeof Kanban; count?: number }[] = [
    ...(space.stages.length ? [{ key: "board" as const, label: "Board", Icon: Kanban }] : []),
    { key: "pages", label: "Pages", Icon: List, count: boardPages.length },
    { key: "tasks", label: "Tasks", Icon: SquareCheckBig, count: openTasks },
    { key: "resources", label: "Resources", Icon: Link2, count: resources.length },
  ];

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140, ...(isDesktop ? { paddingTop: 20 } : null) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Top bar: back, and the space's menu */}
        <View className="px-screen flex-row items-center justify-between pt-2">
          <Pressable onPress={() => goBack("/spaces")} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back to spaces" style={pressScale} className="hover:bg-chip -ml-2 h-[34px] flex-row items-center gap-0.5 rounded-[10px] pl-1 pr-2.5">
            <ChevronLeft size={19} color={c.ink2} strokeWidth={2.2} />
            <Text className="text-ink-2 text-[14px] font-semibold">Spaces</Text>
          </Pressable>
          <View ref={menuRef} collapsable={false}>
            <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Space options" style={pressScale} className="hover:bg-chip h-[34px] w-[34px] items-center justify-center rounded-[10px]">
              <MoreHorizontal size={19} color={c.ink2} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        {/* Name and mark */}
        <View className="px-screen mt-4 flex-row items-center gap-3">
          <View ref={markRef} collapsable={false}>
            <Pressable onPress={() => setMarkOpen(true)} accessibilityRole="button" accessibilityLabel="Change mark" style={pressScale}>
              <SpaceMark space={space} size={44} />
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
              className="text-ink font-serif text-[28px] font-bold tracking-[-0.01em]"
              style={{ paddingVertical: 0 }}
            />
            <Text style={TABULAR} className="text-ink-3 mt-0.5 text-[13px] font-medium">
              {plural(boardPages.length, "page")} · {openTasks} open {openTasks === 1 ? "task" : "tasks"} · {plural(resources.length, "resource")}
            </Text>
          </View>
        </View>

        {/* Tabs + add */}
        <View className="px-screen mt-5 flex-row items-center gap-1.5">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 1, flexShrink: 1 }}>
            {tabs.map(({ key, label, Icon, count }) => {
              const on = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  className={`h-[32px] flex-row items-center gap-1.5 rounded-pill px-3 ${on ? "bg-ink" : "bg-chip hover:opacity-80"}`}
                >
                  <Icon size={14} color={on ? c.bg : c.ink2} strokeWidth={2} />
                  <Text className={`text-[13px] font-semibold ${on ? "text-bg" : "text-ink-2"}`}>{label}</Text>
                  {count ? <Text style={TABULAR} className={`text-[12px] ${on ? "text-bg" : "text-ink-3"}`}>{count}</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <NewInSpace space={space} stage={space.stages[0] ?? null} />
        </View>

        <View className="mt-4">
          {tab === "board" ? (
            <Board space={space} pages={boardPages} />
          ) : tab === "pages" ? (
            <PageList pages={boardPages} />
          ) : tab === "tasks" ? (
            <TaskList spaceId={space.id} tasks={tasks} />
          ) : (
            <ResourceList spaceId={space.id} resources={resources} />
          )}
        </View>
      </ScrollView>

      <Popover anchorRef={menuRef} open={menu} onClose={() => setMenu(false)} width={230} accessibilityLabel="Space options">
        <View className="p-1.5">
          <MenuRow label={space.stages.length ? "Edit pipeline stages" : "Add a pipeline board"} icon={<Waypoints size={15} color={c.ink2} strokeWidth={2} />} onPress={() => { setMenu(false); setStagesOpen(true); }} />
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
    </View>
  );
}

/** "+ New": a blank note or idea, or one from a template, filed in this space (and stage). */
function NewInSpace({ space, stage, compact = false }: { space: Space; stage: string | null; compact?: boolean }) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const ref = useRef<View>(null);
  const createNote = useCreateNote();
  const createIdea = useCreateIdea();
  const templates = useAllTemplates();
  const where = { space_id: space.id, stage };

  const blank = (kind: "note" | "idea") => {
    setOpen(false);
    if (kind === "note") {
      const id = createNote.create({ title: null, type: "text", content: [{ type: "paragraph", text: "" }], folder_id: null, tags: [], ...where });
      router.push(`/note/${id}`);
    } else {
      const id = createIdea.create({ title: "Untitled idea", description: null, content: [], priority: "medium", status: "raw", tags: [], ...where });
      router.push(`/idea/${id}`);
    }
  };
  const fromT = (t: TemplateLike) => {
    setOpen(false);
    const made = fromTemplate(t);
    if (t.kind === "idea") {
      const id = createIdea.create({ title: made.title || "Untitled idea", description: null, content: made.content, priority: "medium", status: "raw", tags: [], properties: made.properties, ...where });
      router.push(`/idea/${id}`);
    } else {
      const id = createNote.create({ title: made.title, type: "text", content: made.content, folder_id: null, tags: [], properties: made.properties, ...where });
      router.push(`/note/${id}`);
    }
  };

  return (
    <>
      <View ref={ref} collapsable={false}>
        {compact ? (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Add to ${stage ?? "this space"}`} className="hover:bg-chip flex-row items-center gap-1.5 rounded-[8px] px-2 py-1.5">
            <Plus size={14} color={c.ink3} strokeWidth={2.2} />
            <Text className="text-ink-3 text-[13px] font-medium">Add</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="New in this space" style={pressScale} className="bg-accent hover:opacity-90 h-[32px] flex-row items-center gap-1.5 rounded-[10px] px-3">
            <Plus size={15} color={c.onAccent} strokeWidth={2.4} />
            <Text className="text-on-accent text-[13px] font-semibold">New</Text>
          </Pressable>
        )}
      </View>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={240} accessibilityLabel="New in this space">
        <View className="p-1.5">
          <MenuRow label="Blank note" icon={<FileText size={15} color={c.ink2} strokeWidth={2} />} onPress={() => blank("note")} />
          <MenuRow label="Blank idea" icon={<Lightbulb size={15} color={c.ink2} strokeWidth={2} />} onPress={() => blank("idea")} />
          <MenuDivider />
          <MenuLabel>From a template</MenuLabel>
          {templates.map((t) => (
            <MenuRow key={t.id} label={t.name} hint={t.kind === "idea" ? "Idea" : "Note"} onPress={() => fromT(t)} />
          ))}
        </View>
      </Popover>
    </>
  );
}

/** The pipeline: one column per stage, cards move with ‹ › (or from the page's Stage field). */
function Board({ space, pages }: { space: Space; pages: BoardPage[] }) {
  const c = useThemeColors();
  const updateNote = useUpdateNote();
  const updateIdea = useUpdateIdea();
  const columns = [...space.stages];
  const orphans = pages.filter((p) => !p.stage || !space.stages.includes(p.stage));
  const setStage = (p: BoardPage, stage: string | null) =>
    p.kind === "note" ? updateNote.mutate({ id: p.id, patch: { stage } }) : updateIdea.mutate({ id: p.id, patch: { stage } });

  const column = (key: string, label: string, items: BoardPage[], index: number) => (
    <View key={key} className="bg-surface border-line rounded-card border p-2" style={{ width: 264 }}>
      <View className="mb-1.5 flex-row items-center justify-between px-1.5 pt-0.5">
        <Text numberOfLines={1} className="text-ink flex-1 text-[13px] font-semibold">
          {label}
        </Text>
        <Text style={TABULAR} className="text-ink-3 text-[12px]">
          {items.length}
        </Text>
      </View>
      <View className="gap-1.5">
        {items.map((p) => (
          <Pressable key={`${p.kind}:${p.id}`} onPress={() => openRef(p)} accessibilityRole="link" className="bg-bg border-line hover:border-accent/[0.4] rounded-[10px] border px-2.5 py-2">
            <View className="flex-row items-start gap-2">
              <View className="pt-[3px]">
                <KindIcon kind={p.kind} color={c.ink3} size={13} />
              </View>
              <Text numberOfLines={3} className="text-ink flex-1 text-[14px] leading-[19px]">
                {p.title}
              </Text>
            </View>
            <View className="mt-1.5 flex-row items-center justify-between">
              <Text className="text-ink-3 text-[11px]">{relativeFromNow(p.updated_at)}</Text>
              <View className="flex-row items-center">
                <Pressable
                  onPress={() => setStage(p, index <= 0 ? null : columns[index - 1]!)}
                  disabled={index < 0}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel="Move to the previous stage"
                  className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]"
                  style={{ opacity: index < 0 ? 0.25 : 1 }}
                >
                  <ChevronLeft size={14} color={c.ink2} strokeWidth={2.2} />
                </Pressable>
                <Pressable
                  onPress={() => setStage(p, columns[index + 1]!)}
                  disabled={index >= columns.length - 1}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel="Move to the next stage"
                  className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]"
                  style={{ opacity: index >= columns.length - 1 ? 0.25 : 1 }}
                >
                  <ChevronRight size={14} color={c.ink2} strokeWidth={2.2} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
      {key !== NO_STAGE ? <NewInSpace space={space} stage={label} compact /> : null}
    </View>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20, alignItems: "flex-start" }}>
      {orphans.length > 0 ? column(NO_STAGE, "No stage", orphans, -1) : null}
      {columns.map((s, i) => column(s, s, pages.filter((p) => p.stage === s), i))}
    </ScrollView>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <Text className="text-ink-3 px-screen py-6 text-center text-[14px] leading-[20px]">{children}</Text>;
}

function PageList({ pages }: { pages: BoardPage[] }) {
  const c = useThemeColors();
  if (pages.length === 0) return <Empty>No notes or ideas here yet. Use New, or set a page's Space field.</Empty>;
  return (
    <View className="px-screen">
      {pages.map((p) => (
        <Pressable key={`${p.kind}:${p.id}`} onPress={() => openRef(p)} accessibilityRole="link" className="hover:bg-chip border-line flex-row items-center gap-3 border-b px-1 py-3">
          <KindIcon kind={p.kind} color={c.ink3} />
          <Text numberOfLines={1} className="text-ink flex-1 text-[15px]">
            {p.title}
          </Text>
          {p.stage ? (
            <View className="bg-accent/[0.1] rounded-[6px] px-1.5 py-0.5">
              <Text className="text-accent text-[12px] font-medium">{p.stage}</Text>
            </View>
          ) : null}
          <Text className="text-ink-3 text-[12px]">{relativeFromNow(p.updated_at)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TaskList({ spaceId, tasks }: { spaceId: string; tasks: ReturnType<typeof usePages>["tasks"] }) {
  const c = useThemeColors();
  const toggle = useToggleTask();
  const createTask = useCreateTask();
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = tasks.filter((t) => t.status !== "complete");
  const done = tasks.filter((t) => t.status === "complete");
  const add = () => {
    const title = draft.trim().slice(0, 200);
    if (!title) return;
    createTask.create({ title, notes: null, due_date: null, due_time: null, reminder_times: [], priority: "medium", repeat: "none", repeat_config: null, space_id: spaceId });
    setDraft("");
  };
  const row = (t: (typeof tasks)[number]) => {
    const complete = t.status === "complete";
    return (
      <View key={t.id} className="border-line flex-row items-center gap-2.5 border-b px-1 py-2.5">
        <Pressable onPress={() => toggle.mutate({ id: t.id, status: complete ? "pending" : "complete" })} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: complete }} accessibilityLabel={t.title}>
          {complete ? <CircleCheck size={20} color={c.accent} strokeWidth={2} /> : <Circle size={20} color={c.ink3} strokeWidth={2} />}
        </Pressable>
        <Pressable onPress={() => openRef({ kind: "task", id: t.id } as Ref)} className="flex-1" accessibilityRole="link">
          <Text numberOfLines={2} className={`text-[15px] ${complete ? "text-ink-3 line-through" : "text-ink"}`}>
            {t.title}
          </Text>
          {t.due_date ? <Text className="text-ink-3 mt-0.5 text-[12px]">Due {t.due_date}</Text> : null}
        </Pressable>
      </View>
    );
  };
  return (
    <View className="px-screen">
      <View className="bg-surface border-line mb-2 h-[44px] flex-row items-center gap-2.5 rounded-[12px] border px-3">
        <Plus size={16} color={c.ink3} strokeWidth={2} />
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add} placeholder="Add a task to this space" placeholderTextColor={c.ink3} returnKeyType="done" maxLength={200} className="text-ink flex-1 text-[15px]" style={{ paddingVertical: 0 }} />
      </View>
      {open.length === 0 && done.length === 0 ? <Empty>No tasks in this space yet.</Empty> : open.map(row)}
      {done.length > 0 ? (
        <Pressable onPress={() => setShowDone((v) => !v)} className="mt-2 px-1 py-2">
          <Text className="text-ink-3 text-[13px] font-medium">{showDone ? "Hide" : "Show"} {plural(done.length, "completed task")}</Text>
        </Pressable>
      ) : null}
      {showDone ? done.map(row) : null}
    </View>
  );
}

function ResourceList({ spaceId, resources }: { spaceId: string; resources: ReturnType<typeof usePages>["resources"] }) {
  const c = useThemeColors();
  const create = useCreateResource();
  const [draft, setDraft] = useState("");
  const add = () => {
    const url = toHttpUrl(draft);
    if (!url) return;
    create.create({ type: "link", url, title: null, domain: domainFrom(url), thumbnail_url: null, duration: null, body: null, tag_ids: [], space_id: spaceId });
    setDraft("");
  };
  return (
    <View className="px-screen">
      <View className="bg-surface border-line mb-2 h-[44px] flex-row items-center gap-2.5 rounded-[12px] border px-3">
        <Link2 size={16} color={c.ink3} strokeWidth={2} />
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={add} placeholder="Paste a link to save it here" placeholderTextColor={c.ink3} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done" className="text-ink flex-1 text-[15px]" style={{ paddingVertical: 0 }} />
      </View>
      {resources.length === 0 ? (
        <Empty>No resources here yet. Paste a link above, or set a resource's space from its menu.</Empty>
      ) : (
        resources.map((r) => (
          <Pressable key={r.id} onPress={() => openRef({ kind: "resource", id: r.id }, r)} accessibilityRole="link" className="hover:bg-chip border-line flex-row items-center gap-3 border-b px-1 py-3">
            <KindIcon kind="resource" color={c.ink3} />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-ink text-[15px]">
                {r.title || r.domain || r.url}
              </Text>
              {r.domain ? <Text className="text-ink-3 mt-0.5 text-[12px]">{r.domain}</Text> : null}
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}
