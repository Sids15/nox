import {
  duplicateSpace,
  useCreateIdea,
  useCreateNote,
  useCreateResource,
  useCreateSpace,
  useCreateTask,
  useDeleteSpace,
  usePrefs,
  useThemeColors,
  useToggleTask,
  useUpdateSpace,
} from "@nox/features";
import type { Space } from "@nox/types";
import {
  addDays,
  capitalize,
  relativeDayLabel,
  relativeFromNow,
  todayKey,
} from "@nox/utils";
import {
  ChevronDown,
  ChevronLeft,
  Circle,
  CircleCheck,
  FileText,
  Lightbulb,
  Link2,
  List,
  MoreHorizontal,
  Pencil,
  SquareCheckBig,
  Trash2,
  Archive,
  Copy,
  CalendarDays,
  Sparkles,
  Search,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { confirmDelete, plural } from "../../lib/confirm";
import { goBack } from "../../lib/go-back";
import { Alert } from "../../lib/alert";
import { router } from "expo-router";
import { useIsDesktop } from "../../lib/use-responsive";
import { MenuDivider, MenuRow, pressScale, TABULAR } from "../menu";
import { Popover } from "../popover";
import { AutoGrowInput } from "../blocks/auto-grow-input";
import { KindIcon } from "./kind-icon";
import { openRef, usePages } from "./pages";
import { SpaceIconPicker, SpaceMark } from "./space-mark";
import { SpaceAsk } from "./space-ask";
import { SpaceCalendar } from "./space-calendar";
import { useAiEnabled } from "../../lib/use-ai";
import { looksLikeUrl, useQuickAdd, type QuickKind } from "./use-quick-add";
import { NewTaskDialog } from "../tasks/new-task-dialog";
import { SpaceGoal } from "./space-goal";

type Kind = QuickKind;
type Filter = "all" | "tasks" | "ideas" | "notes" | "links";

/** One line of a pasted list, without its bullet, number or checkbox ("- ", "2. ", "[ ] "). */
const cleanLine = (l: string) => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s+/, "").trim();
/** The lines of a pasted list (at most 50), or one line for ordinary typing. */
const linesOf = (text: string) => text.split(/\r?\n/).map(cleanLine).filter(Boolean).slice(0, 50);

const WHEN = ["Overdue", "Today", "This week", "Later", "No date"] as const;
/** Which "when" group an open task is in. */
function whenOf(due: string | null, today: string): (typeof WHEN)[number] {
  if (!due) return "No date";
  if (due < today) return "Overdue";
  if (due === today) return "Today";
  if (due <= addDays(today, 6)) return "This week";
  return "Later";
}

/** One row of the space's list: a task, a page (note or idea), or a saved link. */
interface Item {
  key: string;
  kind: "task" | "note" | "idea" | "resource";
  id: string;
  title: string;
  meta: string | null;
  updated_at: string;
  done: boolean;
  /** A task's day, for grouping by when. */
  due: string | null;
}

/**
 * A space: one Add box and one list of everything in it. Type a task, a note title or paste a link;
 * filter by kind; tap to open. Or see its tasks on a calendar.
 */
export function SpaceView({ space }: { space: Space }) {
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const pages = usePages();
  const updateSpace = useUpdateSpace();
  const del = useDeleteSpace();
  const toggle = useToggleTask();
  const quickAdd = useQuickAdd();
  const createSpace = useCreateSpace();
  const createTask = useCreateTask();
  const createNote = useCreateNote();
  const createIdea = useCreateIdea();
  const createResource = useCreateResource();
  const [copying, setCopying] = useState(false);

  /** Copy this space as a fresh start: saved first, then its tasks (cleared), notes, ideas and links. */
  const duplicate = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const plan = duplicateSpace(space, pages);
      const id = await createSpace.createAsync(plan.space);
      for (const t of plan.tasks) createTask.create({ ...t, space_id: id });
      for (const n of plan.notes) createNote.create({ ...n, space_id: id });
      for (const i of plan.ideas) createIdea.create({ ...i, space_id: id });
      for (const r of plan.resources) createResource.create({ ...r, space_id: id });
      router.replace(`/space/${id}`);
      if (plan.mediaLeftOut > 0) {
        Alert.alert("Space copied", `${plan.mediaLeftOut} picture${plan.mediaLeftOut === 1 ? "" : "s"} or recording${plan.mediaLeftOut === 1 ? "" : "s"} stayed in the original — copies keep the text.`);
      }
    } catch {
      Alert.alert("Couldn't copy the space", "Check your connection and try again.");
    } finally {
      setCopying(false);
    }
  };
  const calendarOn = usePrefs((s) => !!s.spaceCalendars[space.id]);
  const setCalendar = usePrefs((s) => s.setSpaceCalendar);

  const [name, setName] = useState(space.name);
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<Kind>("task");
  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [asking, setAsking] = useState(false);
  // The full task composer (day, time, priority, repeat, reminders…), started from what's typed.
  const [composing, setComposing] = useState<string | null>(null);
  const aiOn = useAiEnabled();
  const [iconOpen, setIconOpen] = useState(false);
  const menuRef = useRef<View>(null);
  const iconRef = useRef<View>(null);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => setName(space.name), [space.id, space.name]);
  // A pasted link is a link, whatever was picked.
  const lines = linesOf(draft);
  const many = lines.length > 1;
  const isLink = !many && looksLikeUrl(draft);
  const effective: Kind = isLink ? "link" : kind === "link" ? "task" : kind;

  const today = todayKey();
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const t of pages.tasks) {
      if (
        t.space_id !== space.id ||
        t.deleted ||
        (t.repeat !== "none" && t.origin_task_id === null)
      )
        continue;
      out.push({
        key: `task:${t.id}`,
        kind: "task",
        id: t.id,
        title: t.title,
        meta: t.due_date
          ? capitalize(relativeDayLabel(t.due_date, today))
          : null,
        updated_at: t.updated_at,
        done: t.status === "complete",
        due: t.due_date,
      });
    }
    for (const n of pages.notes) {
      if (n.space_id !== space.id || n.is_archived) continue;
      const p = pages.find({ kind: "note", id: n.id });
      out.push({
        key: `note:${n.id}`,
        kind: "note",
        id: n.id,
        title: p?.title ?? "Untitled note",
        meta: null,
        updated_at: n.updated_at,
        done: false,
        due: null,
      });
    }
    for (const i of pages.ideas) {
      if (i.space_id !== space.id || i.is_archived || i.status === "dropped")
        continue;
      out.push({
        key: `idea:${i.id}`,
        kind: "idea",
        id: i.id,
        title: i.title || "Untitled idea",
        meta: null,
        updated_at: i.updated_at,
        done: false,
        due: null,
      });
    }
    for (const r of pages.resources) {
      if (r.space_id !== space.id || r.is_archived) continue;
      out.push({
        key: `resource:${r.id}`,
        kind: "resource",
        id: r.id,
        title: r.title?.trim() || r.domain || r.url || "Link",
        meta: r.domain,
        updated_at: r.updated_at,
        done: false,
        due: null,
      });
    }
    return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [pages, space.id, today]);

  // Each filter is one kind; a filter with nothing in it isn't shown.
  const KIND_OF: Record<Exclude<Filter, "all">, Item["kind"]> = { tasks: "task", ideas: "idea", notes: "note", links: "resource" };
  const counts = {
    all: items.filter((i) => !i.done).length,
    tasks: items.filter((i) => i.kind === "task" && !i.done).length,
    ideas: items.filter((i) => i.kind === "idea").length,
    notes: items.filter((i) => i.kind === "note").length,
    links: items.filter((i) => i.kind === "resource").length,
  };
  const q = query.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      (filter === "all" || i.kind === KIND_OF[filter]) &&
      (!q || i.title.toLowerCase().includes(q) || (i.meta ?? "").toLowerCase().includes(q)),
  );
  const open = shown.filter((i) => !i.done);
  const done = shown.filter((i) => i.done);

  const add = async () => {
    const raw = draft.trim();
    if (!raw) return;
    setDraft("");
    // A pasted list: one item per line (a line that's a web address is saved as a link).
    for (const line of many ? lines : [raw]) {
      await quickAdd(line, many && looksLikeUrl(line) ? "link" : effective, { spaceId: space.id });
    }
  };

  const commitName = () => {
    const n = name.trim().slice(0, 80);
    if (n && n !== space.name)
      updateSpace.mutate({ id: space.id, patch: { name: n } });
    else setName(space.name);
  };

  const row = (i: Item) => (
    <Pressable
      key={i.key}
      onPress={() =>
        openRef(
          { kind: i.kind, id: i.id },
          i.kind === "resource" ? pages.resource(i.id) : undefined,
        )
      }
      accessibilityRole="link"
      className="hover:bg-surface border-line flex-row items-center gap-3 border-b px-1 py-3"
    >
      {i.kind === "task" ? (
        <Pressable
          onPress={() =>
            toggle.mutate({ id: i.id, status: i.done ? "pending" : "complete" })
          }
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: i.done }}
          accessibilityLabel={i.title}
        >
          {i.done ? (
            <CircleCheck size={19} color={c.accent} strokeWidth={2} />
          ) : (
            <Circle size={19} color={c.ink3} strokeWidth={2} />
          )}
        </Pressable>
      ) : (
        <View style={{ width: 19, alignItems: "center" }}>
          <KindIcon kind={i.kind} color={c.ink3} size={16} />
        </View>
      )}
      <Text
        numberOfLines={1}
        className={`flex-1 text-[15px] ${i.done ? "text-ink-3 line-through" : "text-ink"}`}
      >
        {i.title}
      </Text>
      {i.meta ? (
        <Text
          numberOfLines={1}
          className="text-ink-3 max-w-[140px] text-[12px]"
        >
          {i.meta}
        </Text>
      ) : null}
      <Text className="text-ink-3 w-[60px] text-right text-[12px]">
        {relativeFromNow(i.updated_at)}
      </Text>
    </Pressable>
  );

  const KINDS: { key: Kind; label: string; Icon: typeof FileText }[] = [
    { key: "task", label: "Task", Icon: SquareCheckBig },
    { key: "idea", label: "Idea", Icon: Lightbulb },
    { key: "note", label: "Note", Icon: FileText },
    // A link is picked for you when one is pasted.
    ...(isLink ? [{ key: "link" as Kind, label: "Link", Icon: Link2 }] : []),
  ];
  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "tasks", label: "Tasks", n: counts.tasks },
    { key: "ideas", label: "Ideas", n: counts.ideas },
    { key: "notes", label: "Notes", n: counts.notes },
    { key: "links", label: "Links", n: counts.links },
  ];

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 140,
          ...(isDesktop ? { paddingTop: 16 } : null),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        {/* Pinned: back · icon + name · list/calendar · menu */}
        <View className="bg-bg pb-2">
          <View
            className="px-screen flex-row items-center gap-3 pt-2"
            style={{
              maxWidth: calendarOn ? 1100 : 820,
              width: "100%",
              alignSelf: "center",
            }}
          >
            <Pressable
              onPress={() => goBack("/spaces")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Back to spaces"
              style={pressScale}
              className="hover:bg-chip -ml-2 h-[34px] w-[34px] items-center justify-center rounded-[10px]"
            >
              <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
            </Pressable>
            <View ref={iconRef} collapsable={false}>
              <Pressable
                onPress={() => setIconOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Change icon"
                style={pressScale}
              >
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
            <View
              className="bg-chip flex-row rounded-[10px] p-0.5"
              accessibilityRole="tablist"
            >
              {[
                {
                  on: !calendarOn,
                  label: "List",
                  Icon: List,
                  pick: () => setCalendar(space.id, false),
                },
                {
                  on: calendarOn,
                  label: "Calendar",
                  Icon: CalendarDays,
                  pick: () => setCalendar(space.id, true),
                },
              ].map(({ on, label, Icon, pick }) => (
                <Pressable
                  key={label}
                  onPress={pick}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={label}
                  className={`h-[30px] flex-row items-center gap-1.5 rounded-[8px] px-2 ${on ? "bg-surface" : ""}`}
                >
                  <Icon size={15} color={on ? c.ink : c.ink3} strokeWidth={2} />
                  {isDesktop ? (
                    <Text
                      className={`text-[13px] font-semibold ${on ? "text-ink" : "text-ink-3"}`}
                    >
                      {label}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
            {aiOn ? (
              <Pressable
                onPress={() => setAsking(true)}
                accessibilityRole="button"
                accessibilityLabel={`Ask Nox about ${space.name}`}
                style={pressScale}
                className="hover:bg-chip h-[34px] flex-row items-center gap-1.5 rounded-[10px] px-2"
              >
                <Sparkles size={16} color={c.ink2} strokeWidth={2} />
                {isDesktop ? (
                  <Text className="text-ink-2 text-[13px] font-semibold">
                    Ask
                  </Text>
                ) : null}
              </Pressable>
            ) : null}
            <View ref={menuRef} collapsable={false}>
              <Pressable
                onPress={() => setMenu(true)}
                accessibilityRole="button"
                accessibilityLabel="Space options"
                style={pressScale}
                className="hover:bg-chip h-[34px] w-[34px] items-center justify-center rounded-[10px]"
              >
                <MoreHorizontal size={19} color={c.ink2} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* What it's for, by when, and how far along. */}
        <View
          className="px-screen mt-1"
          style={{ maxWidth: calendarOn ? 1100 : 820, width: "100%", alignSelf: "center" }}
        >
          <SpaceGoal
            space={space}
            done={items.filter((i) => i.kind === "task" && i.done).length}
            total={items.filter((i) => i.kind === "task").length}
          />
        </View>

        {calendarOn ? (
          <View
            className="px-screen mt-3"
            style={{ maxWidth: 1100, width: "100%", alignSelf: "center" }}
          >
            <SpaceCalendar space={space} />
          </View>
        ) : (
          <View
            className="px-screen"
            style={{ maxWidth: 820, width: "100%", alignSelf: "center" }}
          >
            {/* The one Add box: a task by default, a note if picked, a link when one is pasted. */}
            <View className="bg-surface border-line mt-3 rounded-[14px] border px-3 pb-2 pt-2.5">
              <AutoGrowInput
                value={draft}
                onChangeText={setDraft}
                // Enter adds (one handler per platform, so it never adds twice); pasted lines stay lines.
                {...(Platform.OS === "web"
                  ? {
                      onKeyPress: (e: { nativeEvent: unknown; preventDefault?: () => void }) => {
                        const ne = e.nativeEvent as { key: string; shiftKey?: boolean; isComposing?: boolean };
                        if (ne.key === "Enter" && !ne.shiftKey && !ne.isComposing) {
                          e.preventDefault?.();
                          void add();
                        }
                      },
                    }
                  : { submitBehavior: "submit" as const, onSubmitEditing: () => void add() })}
                placeholder={
                  effective === "note"
                    ? "Name a note…"
                    : effective === "idea"
                      ? "Name an idea…"
                      : effective === "link"
                        ? ""
                        : "Add a task (e.g. film intro friday), or paste a list or a link"
                }
                placeholderTextColor={c.ink3}
                returnKeyType="done"
                maxLength={isLink || many ? 4000 : 200}
                autoCapitalize={isLink ? "none" : "sentences"}
                accessibilityLabel="Add to this space"
                className="text-ink text-[16px]"
                style={{ paddingVertical: 4, maxHeight: 160 }}
              />
              <View className="mt-1.5 flex-row flex-wrap items-center gap-1">
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
                      <Icon
                        size={13}
                        color={on ? c.accent : c.ink3}
                        strokeWidth={2}
                      />
                      <Text
                        className={`text-[13px] font-medium ${on ? "text-accent" : "text-ink-3"}`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
                <View className="flex-1" />
                {effective === "task" && !many ? (
                  <Pressable
                    onPress={() => {
                      setComposing(draft.trim());
                      setDraft("");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Add a task with a day, time, priority, repeat or reminders"
                    className="hover:bg-chip h-[28px] flex-row items-center gap-1.5 rounded-[8px] px-2"
                  >
                    <CalendarDays size={13} color={c.ink2} strokeWidth={2} />
                    <Text className="text-ink-2 text-[13px] font-medium">Details</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => void add()}
                  disabled={!draft.trim()}
                  accessibilityRole="button"
                  style={pressScale}
                  className="bg-accent h-[28px] rounded-[8px] px-3 justify-center"
                  {...({ title: "Add (Enter)" } as object)}
                >
                  <Text
                    className="text-on-accent text-[13px] font-semibold"
                    style={{ opacity: draft.trim() ? 1 : 0.6 }}
                  >
                    {many ? `Add ${lines.length}` : "Add"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {items.length > 0 && searching ? (
              <View className="bg-chip mt-4 h-[34px] flex-row items-center gap-2 rounded-pill px-3">
                <Search size={14} color={c.ink3} strokeWidth={2.2} />
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${space.name}`}
                  placeholderTextColor={c.ink3}
                  returnKeyType="search"
                  accessibilityLabel="Search this space"
                  className="text-ink flex-1 text-[14px]"
                  style={{ paddingVertical: 0, outlineWidth: 0 } as object}
                />
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setSearching(false);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close search"
                >
                  <X size={15} color={c.ink3} strokeWidth={2.2} />
                </Pressable>
              </View>
            ) : null}
            {items.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className={searching ? "mt-2" : "mt-4"}
                contentContainerStyle={{ gap: 6 }}
              >
                {!searching ? (
                  <Pressable
                    onPress={() => setSearching(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Search this space"
                    className="bg-chip h-[30px] w-[30px] items-center justify-center rounded-pill hover:opacity-80"
                  >
                    <Search size={14} color={c.ink2} strokeWidth={2.2} />
                  </Pressable>
                ) : null}
                {FILTERS.filter((f) => f.key === "all" || f.key === filter || items.some((i) => i.kind === KIND_OF[f.key as Exclude<Filter, "all">])).map(({ key, label, n }) => {
                  const on = filter === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setFilter(key)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      className={`h-[30px] flex-row items-center gap-1.5 rounded-pill px-3 ${on ? "bg-ink" : "bg-chip hover:opacity-80"}`}
                    >
                      <Text
                        className={`text-[13px] font-semibold ${on ? "text-bg" : "text-ink-2"}`}
                      >
                        {label}
                      </Text>
                      {n ? (
                        <Text
                          style={TABULAR}
                          className={`text-[12px] ${on ? "text-bg" : "text-ink-3"}`}
                        >
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
                  Nothing here yet. Add a task, an idea or a note above, or paste
                  a link.
                </Text>
              ) : open.length === 0 && done.length === 0 ? (
                <Text className="text-ink-3 py-8 text-center text-[14px]">
                  {q ? `Nothing matches “${query.trim()}”.` : "Nothing of this kind yet."}
                </Text>
              ) : filter === "tasks" ? (
                // Tasks by when: what's late, today, this week, later, and undated.
                WHEN.map((w) => {
                  const group = open
                    .filter((i) => whenOf(i.due, today) === w)
                    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
                  if (group.length === 0) return null;
                  return (
                    <View key={w}>
                      <Text
                        className={`mt-3 px-1 text-[12px] font-semibold ${w === "Overdue" ? "text-high" : "text-ink-3"}`}
                      >
                        {w} <Text style={TABULAR} className="text-ink-3 font-medium">{group.length}</Text>
                      </Text>
                      {group.map(row)}
                    </View>
                  );
                })
              ) : (
                open.map(row)
              )}
              {done.length > 0 ? (
                <Pressable
                  onPress={() => setShowDone((v) => !v)}
                  accessibilityRole="button"
                  className="mt-2 flex-row items-center gap-1.5 px-1 py-2"
                >
                  <ChevronDown
                    size={14}
                    color={c.ink3}
                    strokeWidth={2.2}
                    style={{
                      transform: [{ rotate: showDone ? "0deg" : "-90deg" }],
                    }}
                  />
                  <Text className="text-ink-3 text-[13px] font-medium">
                    {plural(done.length, "done task")}
                  </Text>
                </Pressable>
              ) : null}
              {showDone ? done.map(row) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <Popover
        anchorRef={menuRef}
        open={menu}
        onClose={() => setMenu(false)}
        width={280}
        accessibilityLabel="Space options"
      >
        <View className="p-1.5">
          <MenuRow
            label="Rename"
            icon={<Pencil size={15} color={c.ink2} strokeWidth={2} />}
            onPress={() => {
              setMenu(false);
              setTimeout(() => nameRef.current?.focus(), 50);
            }}
          />
          <MenuRow
            label="Duplicate as a fresh start"
            hint="Dates cleared"
            icon={<Copy size={15} color={c.ink2} strokeWidth={2} />}
            onPress={() => {
              setMenu(false);
              void duplicate();
            }}
          />
          <MenuRow
            label={space.archived ? "Unarchive" : "Archive — it's finished"}
            icon={<Archive size={15} color={c.ink2} strokeWidth={2} />}
            onPress={() => {
              setMenu(false);
              updateSpace.mutate({
                id: space.id,
                patch: { archived: !space.archived },
              });
            }}
          />
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
      <Popover
        anchorRef={iconRef}
        open={iconOpen}
        onClose={() => setIconOpen(false)}
        width={212}
        accessibilityLabel="Icon"
      >
        <View className="p-2">
          <SpaceIconPicker
            value={space.icon}
            onChange={(icon) => {
              setIconOpen(false);
              if (icon !== space.icon)
                updateSpace.mutate({ id: space.id, patch: { icon } });
            }}
          />
        </View>
      </Popover>
      <NewTaskDialog
        visible={composing !== null}
        initialDate={null}
        initialTitle={composing ?? ""}
        spaceId={space.id}
        onClose={() => setComposing(null)}
      />
      <SpaceAsk
        space={space}
        visible={asking}
        onClose={() => setAsking(false)}
      />
    </View>
  );
}
