import {
  parseQuickAdd,
  useCreateNote,
  useCreateResource,
  useCreateTask,
  useDeleteSpace,
  usePrefs,
  useThemeColors,
  useToggleTask,
  useUpdateResource,
  useUpdateSpace,
} from "@nox/features";
import type { Space } from "@nox/types";
import { capitalize, domainFrom, relativeDayLabel, relativeFromNow, todayKey } from "@nox/utils";
import {
  ChevronDown,
  ChevronLeft,
  Circle,
  CircleCheck,
  FileText,
  Kanban,
  Link2,
  List,
  MoreHorizontal,
  Pencil,
  SquareCheckBig,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { confirmDelete, plural } from "../../lib/confirm";
import { goBack } from "../../lib/go-back";
import { fetchUrlMeta, videoThumbnail } from "../../lib/url-meta";
import { useIsDesktop } from "../../lib/use-responsive";
import { MenuDivider, MenuRow, pressScale, TABULAR } from "../menu";
import { Popover } from "../popover";
import { KindIcon } from "./kind-icon";
import { openRef, usePages } from "./pages";
import { SpaceBoard } from "./space-board";
import { SpaceIconPicker, SpaceMark } from "./space-mark";
import { NewInSpace, type SpacePage } from "./space-parts";
import { StageEditor } from "./stage-editor";

type Kind = "task" | "note" | "link";
type Filter = "all" | "notes" | "tasks" | "links";
const looksLikeUrl = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim());
const DEFAULT_STAGES = ["To do", "In progress", "Done"];

/** One row of the space's list: a task, a page (note or idea), or a saved link. */
interface Item {
  key: string;
  kind: "task" | "note" | "idea" | "resource";
  id: string;
  title: string;
  meta: string | null;
  updated_at: string;
  done: boolean;
}

/**
 * A space: one Add box and one list of everything in it. Type a task, a note title or paste a link;
 * filter by kind; tap to open. A board is optional (⋯ → Show as a board) for anything with stages.
 */
export function SpaceView({ space }: { space: Space }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const pages = usePages();
  const updateSpace = useUpdateSpace();
  const del = useDeleteSpace();
  const toggle = useToggleTask();
  const createTask = useCreateTask();
  const createNote = useCreateNote();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const boardOn = usePrefs((s) => !!s.spaceBoards[space.id]) && space.stages.length > 0;
  const setBoard = usePrefs((s) => s.setSpaceBoard);

  const [name, setName] = useState(space.name);
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<Kind>("task");
  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);
  const [menu, setMenu] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const menuRef = useRef<View>(null);
  const iconRef = useRef<View>(null);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => setName(space.name), [space.id, space.name]);
  // A pasted link is a link, whatever was picked.
  const isLink = looksLikeUrl(draft);
  const effective: Kind = isLink ? "link" : kind === "link" ? "task" : kind;

  const today = todayKey();
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const t of pages.tasks) {
      if (t.space_id !== space.id || t.deleted || (t.repeat !== "none" && t.origin_task_id === null)) continue;
      out.push({ key: `task:${t.id}`, kind: "task", id: t.id, title: t.title, meta: t.due_date ? capitalize(relativeDayLabel(t.due_date, today)) : null, updated_at: t.updated_at, done: t.status === "complete" });
    }
    for (const n of pages.notes) {
      if (n.space_id !== space.id || n.is_archived) continue;
      const p = pages.find({ kind: "note", id: n.id });
      out.push({ key: `note:${n.id}`, kind: "note", id: n.id, title: p?.title ?? "Untitled note", meta: n.stage, updated_at: n.updated_at, done: false });
    }
    for (const i of pages.ideas) {
      if (i.space_id !== space.id || i.is_archived || i.status === "dropped") continue;
      out.push({ key: `idea:${i.id}`, kind: "idea", id: i.id, title: i.title || "Untitled idea", meta: i.stage, updated_at: i.updated_at, done: false });
    }
    for (const r of pages.resources) {
      if (r.space_id !== space.id || r.is_archived) continue;
      out.push({ key: `resource:${r.id}`, kind: "resource", id: r.id, title: r.title?.trim() || r.domain || r.url || "Link", meta: r.domain, updated_at: r.updated_at, done: false });
    }
    return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [pages, space.id, today]);

  const counts = {
    all: items.filter((i) => !i.done).length,
    notes: items.filter((i) => i.kind === "note" || i.kind === "idea").length,
    tasks: items.filter((i) => i.kind === "task" && !i.done).length,
    links: items.filter((i) => i.kind === "resource").length,
  };
  const shown = items.filter((i) =>
    filter === "all" ? true : filter === "notes" ? i.kind === "note" || i.kind === "idea" : filter === "tasks" ? i.kind === "task" : i.kind === "resource",
  );
  const open = shown.filter((i) => !i.done);
  const done = shown.filter((i) => i.done);

  const boardPages = useMemo<SpacePage[]>(
    () =>
      [
        ...pages.notes.filter((n) => n.space_id === space.id && !n.is_archived).map((n) => ({ ...pages.find({ kind: "note", id: n.id })!, stage: n.stage, properties: n.properties, tags: n.tags })),
        ...pages.ideas
          .filter((i) => i.space_id === space.id && !i.is_archived && i.status !== "dropped")
          .map((i) => ({ ...pages.find({ kind: "idea", id: i.id })!, stage: i.stage, properties: i.properties, tags: i.tags })),
      ].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [pages, space.id],
  );

  const add = async () => {
    const raw = draft.trim();
    if (!raw) return;
    setDraft("");
    if (effective === "link") {
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const thumb = videoThumbnail(url) ?? null;
      const id = createResource.create({ type: thumb ? "video" : "link", url, title: null, domain: domainFrom(url), thumbnail_url: thumb, duration: null, body: null, tag_ids: [], space_id: space.id });
      const meta = await fetchUrlMeta(url);
      if (meta?.title || (meta?.image && !thumb)) updateResource.mutate({ id, patch: { title: meta.title ?? null, ...(meta.image && !thumb ? { thumbnail_url: meta.image } : {}) } });
    } else if (effective === "note") {
      createNote.create({ title: raw.slice(0, 200), type: "text", content: [{ type: "paragraph", text: "" }], folder_id: null, tags: [], space_id: space.id, stage: boardOn ? (space.stages[0] ?? null) : null });
    } else {
      // Tasks understand the same plain words as everywhere else: "film intro friday 3pm".
      const p = parseQuickAdd(raw, today);
      createTask.create({
        title: (p.title || raw).slice(0, 200),
        notes: null,
        due_date: p.date ?? null,
        due_time: p.time ?? null,
        ...(p.duration ? { duration_minutes: p.duration } : {}),
        reminder_times: [],
        priority: p.priority ?? "medium",
        repeat: "none",
        repeat_config: null,
        space_id: space.id,
      });
    }
  };

  const commitName = () => {
    const n = name.trim().slice(0, 80);
    if (n && n !== space.name) updateSpace.mutate({ id: space.id, patch: { name: n } });
    else setName(space.name);
  };

  const row = (i: Item) => (
    <Pressable
      key={i.key}
      onPress={() => openRef({ kind: i.kind, id: i.id }, i.kind === "resource" ? pages.resource(i.id) : undefined)}
      accessibilityRole="link"
      className="hover:bg-surface border-line flex-row items-center gap-3 border-b px-1 py-3"
    >
      {i.kind === "task" ? (
        <Pressable onPress={() => toggle.mutate({ id: i.id, status: i.done ? "pending" : "complete" })} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: i.done }} accessibilityLabel={i.title}>
          {i.done ? <CircleCheck size={19} color={c.accent} strokeWidth={2} /> : <Circle size={19} color={c.ink3} strokeWidth={2} />}
        </Pressable>
      ) : (
        <View style={{ width: 19, alignItems: "center" }}>
          <KindIcon kind={i.kind} color={c.ink3} size={16} />
        </View>
      )}
      <Text numberOfLines={1} className={`flex-1 text-[15px] ${i.done ? "text-ink-3 line-through" : "text-ink"}`}>
        {i.title}
      </Text>
      {i.meta && (i.kind === "note" || i.kind === "idea") ? (
        <View className="bg-accent/[0.1] rounded-[6px] px-1.5 py-0.5">
          <Text className="text-accent text-[12px] font-medium">{i.meta}</Text>
        </View>
      ) : i.meta ? (
        <Text numberOfLines={1} className="text-ink-3 max-w-[140px] text-[12px]">
          {i.meta}
        </Text>
      ) : null}
      <Text className="text-ink-3 w-[60px] text-right text-[12px]">{relativeFromNow(i.updated_at)}</Text>
    </Pressable>
  );

  const KINDS: { key: Kind; label: string; Icon: typeof FileText }[] = [
    { key: "task", label: "Task", Icon: SquareCheckBig },
    { key: "note", label: "Note", Icon: FileText },
    { key: "link", label: "Link", Icon: Link2 },
  ];
  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "notes", label: "Notes", n: counts.notes },
    { key: "tasks", label: "Tasks", n: counts.tasks },
    { key: "links", label: "Links", n: counts.links },
  ];

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 140, ...(isDesktop ? { paddingTop: 16 } : null) }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        {/* Pinned: back · icon + name · board/list · menu */}
        <View className="bg-bg pb-2">
          <View className="px-screen flex-row items-center gap-3 pt-2" style={{ maxWidth: boardOn ? undefined : 820, width: "100%", alignSelf: "center" }}>
            <Pressable onPress={() => goBack("/spaces")} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back to spaces" style={pressScale} className="hover:bg-chip -ml-2 h-[34px] w-[34px] items-center justify-center rounded-[10px]">
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <View ref={iconRef} collapsable={false}>
              <Pressable onPress={() => setIconOpen(true)} accessibilityRole="button" accessibilityLabel="Change icon" style={pressScale}>
                <SpaceMark space={space} size={36} />
              </Pressable>
            </View>
            <TextInput
              ref={nameRef}
              value={name}
              onChangeText={setName}
              onBlur={commitName}
              onSubmitEditing={commitName}
              maxLength={80}
              accessibilityLabel="Space name"
              className="text-ink min-w-0 flex-1 font-serif text-[24px] font-bold tracking-[-0.01em]"
              style={{ paddingVertical: 0 }}
            />
            {space.stages.length > 0 ? (
              <View className="bg-chip flex-row rounded-[10px] p-0.5" accessibilityRole="tablist">
                {([
                  { on: !boardOn, label: "List", Icon: List, board: false },
                  { on: boardOn, label: "Board", Icon: Kanban, board: true },
                ] as const).map(({ on, label, Icon, board }) => (
                  <Pressable
                    key={label}
                    onPress={() => setBoard(space.id, board)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={label}
                    className={`h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2 ${on ? "bg-surface" : ""}`}
                  >
                    <Icon size={15} color={on ? c.ink : c.ink3} strokeWidth={2} />
                    {isDesktop ? <Text className={`text-[13px] font-semibold ${on ? "text-ink" : "text-ink-3"}`}>{label}</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View ref={menuRef} collapsable={false}>
              <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Space options" style={pressScale} className="hover:bg-chip h-[34px] w-[34px] items-center justify-center rounded-[10px]">
                <MoreHorizontal size={19} color={c.ink2} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        </View>

        {boardOn ? (
          <View className="mt-2">
            <View className="px-screen mb-3 flex-row items-center justify-between">
              <Text className="text-ink-3 text-[13px]">Notes and ideas by stage. Tasks and links are in the list.</Text>
              <NewInSpace space={space} stage={space.stages[0] ?? null} />
            </View>
            <SpaceBoard space={space} pages={boardPages} />
          </View>
        ) : (
          <View className="px-screen" style={{ maxWidth: 820, width: "100%", alignSelf: "center" }}>
            {/* The one Add box: a task by default, a note if picked, a link when one is pasted. */}
            <View className="bg-surface border-line mt-3 rounded-[14px] border px-3 pb-2 pt-2.5">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => void add()}
                placeholder={effective === "note" ? "Note title…" : "Add a task, or paste a link…"}
                placeholderTextColor={c.ink3}
                returnKeyType="done"
                maxLength={isLink ? 4000 : 200}
                autoCapitalize={isLink ? "none" : "sentences"}
                accessibilityLabel="Add to this space"
                className="text-ink text-[16px]"
                style={{ paddingVertical: 4 }}
              />
              <View className="mt-1.5 flex-row items-center gap-1">
                {KINDS.map(({ key, label, Icon }) => {
                  const on = effective === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setKind(key)}
                      disabled={key === "link" && !isLink}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      className={`h-[28px] flex-row items-center gap-1.5 rounded-[8px] px-2 ${on ? "bg-accent/[0.12]" : "hover:bg-chip"}`}
                      style={{ opacity: key === "link" && !isLink ? 0.45 : 1 }}
                    >
                      <Icon size={13} color={on ? c.accent : c.ink3} strokeWidth={2} />
                      <Text className={`text-[13px] font-medium ${on ? "text-accent" : "text-ink-3"}`}>{label}</Text>
                    </Pressable>
                  );
                })}
                <View className="flex-1" />
                {/* Blank pages and templates (PRD, video idea…), one tap away. */}
                <NewInSpace space={space} stage={null} variant="plus" />
                <Pressable onPress={() => void add()} disabled={!draft.trim()} accessibilityRole="button" style={pressScale} className="bg-accent h-[28px] rounded-[8px] px-3 justify-center" {...({ title: "Add (Enter)" } as object)}>
                  <Text className="text-on-accent text-[13px] font-semibold" style={{ opacity: draft.trim() ? 1 : 0.6 }}>
                    Add
                  </Text>
                </Pressable>
              </View>
            </View>

            {items.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4" contentContainerStyle={{ gap: 6 }}>
                {FILTERS.map(({ key, label, n }) => {
                  const on = filter === key;
                  return (
                    <Pressable key={key} onPress={() => setFilter(key)} accessibilityRole="tab" accessibilityState={{ selected: on }} className={`h-[30px] flex-row items-center gap-1.5 rounded-pill px-3 ${on ? "bg-ink" : "bg-chip hover:opacity-80"}`}>
                      <Text className={`text-[13px] font-semibold ${on ? "text-bg" : "text-ink-2"}`}>{label}</Text>
                      {n ? (
                        <Text style={TABULAR} className={`text-[12px] ${on ? "text-bg" : "text-ink-3"}`}>
                          {n}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <View className="mt-2">
              {items.length === 0 ? (
                <Text className="text-ink-3 py-8 text-center text-[14px] leading-[20px]">
                  Nothing here yet. Add a task above, paste a link, or tap + for a note or a template.
                </Text>
              ) : open.length === 0 && done.length === 0 ? (
                <Text className="text-ink-3 py-8 text-center text-[14px]">Nothing of this kind yet.</Text>
              ) : (
                open.map(row)
              )}
              {done.length > 0 ? (
                <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" className="mt-2 flex-row items-center gap-1.5 px-1 py-2">
                  <ChevronDown size={14} color={c.ink3} strokeWidth={2.2} style={{ transform: [{ rotate: showDone ? "0deg" : "-90deg" }] }} />
                  <Text className="text-ink-3 text-[13px] font-medium">{plural(done.length, "done task")}</Text>
                </Pressable>
              ) : null}
              {showDone ? done.map(row) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <Popover anchorRef={menuRef} open={menu} onClose={() => setMenu(false)} width={240} accessibilityLabel="Space options">
        <View className="p-1.5">
          {space.stages.length === 0 ? (
            <MenuRow
              label="Show as a board"
              hint="Stages"
              icon={<Kanban size={15} color={c.ink2} strokeWidth={2} />}
              onPress={() => {
                setMenu(false);
                updateSpace.mutate({ id: space.id, patch: { stages: DEFAULT_STAGES } });
                setBoard(space.id, true);
              }}
            />
          ) : (
            <MenuRow label="Edit board stages" icon={<Kanban size={15} color={c.ink2} strokeWidth={2} />} onPress={() => { setMenu(false); setStagesOpen(true); }} />
          )}
          <MenuRow label="Rename" icon={<Pencil size={15} color={c.ink2} strokeWidth={2} />} onPress={() => { setMenu(false); setTimeout(() => nameRef.current?.focus(), 50); }} />
          <MenuDivider />
          <MenuRow
            label="Delete space"
            danger
            icon={<Trash2 size={15} color={c.high} strokeWidth={2} />}
            onPress={() => {
              setMenu(false);
              confirmDelete({
                title: "Delete space?",
                message: `“${space.name}” will be deleted on all your devices. Everything in it is kept, just no longer in a space.`,
                onConfirm: () => {
                  del.mutate(space.id);
                  goBack("/spaces");
                },
              });
            }}
          />
        </View>
      </Popover>
      <Popover anchorRef={iconRef} open={iconOpen} onClose={() => setIconOpen(false)} width={212} accessibilityLabel="Icon">
        <View className="p-2">
          <SpaceIconPicker
            value={space.icon}
            onChange={(icon) => {
              setIconOpen(false);
              if (icon !== space.icon) updateSpace.mutate({ id: space.id, patch: { icon } });
            }}
          />
        </View>
      </Popover>
      <StageEditor space={space} visible={stagesOpen} onClose={() => setStagesOpen(false)} />
    </View>
  );
}
