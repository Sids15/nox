import { useFolders, useIdeas, useNotes, useResources, useTasks, useThemeColors, useThemeVars } from "@nox/features";
import { capitalize, formatTime12, relativeDayLabel, todayKey } from "@nox/utils";
import { useRouter } from "expo-router";
import { Bookmark, CornerDownLeft, FileText, Lightbulb, Search, Settings2, SquareCheckBig, type LucideIcon } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { openExternal } from "../lib/open-external";
import { noteMatches, noteTitle } from "./notes/note-utils";

interface Hit {
  key: string;
  title: string;
  /** Where it lives and, when the match is in the body, the words around it. */
  detail?: string;
  type: string;
  icon: LucideIcon;
  route: string;
  /** Resources have no detail route — open their link directly (undefined for other types). */
  url?: string | null;
}

/** The words around the first match in `text` (about 70 characters), or null if it isn't there. */
function snippet(text: string | null | undefined, needle: string): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(needle);
  if (i === -1) return null;
  const from = Math.max(0, i - 24);
  const to = Math.min(flat.length, i + needle.length + 46);
  return `${from > 0 ? "…" : ""}${flat.slice(from, to).trim()}${to < flat.length ? "…" : ""}`;
}

const PAGES: Hit[] = [
  { key: "go:tasks", title: "Tasks", detail: "Today and your calendar", type: "Go to", icon: SquareCheckBig, route: "/tasks" },
  { key: "go:notes", title: "Notes", detail: "Folders and tags", type: "Go to", icon: FileText, route: "/notes" },
  { key: "go:ideas", title: "Ideas", detail: "The board, raw to complete", type: "Go to", icon: Lightbulb, route: "/" },
  { key: "go:resources", title: "Resources", detail: "Links, videos, pictures, snippets", type: "Go to", icon: Bookmark, route: "/resources" },
  { key: "go:settings", title: "Settings", detail: "Appearance, calendar, notifications", type: "Go to", icon: Settings2, route: "/settings" },
];

/**
 * Global search across all four modules (the sidebar's ⌘K). Each result says where it lives (a note's
 * folder, a task's day, an idea's stage, a resource's site) and shows the words around a match in the
 * body. ↑ ↓ move, Enter opens, Esc closes; before typing it offers the pages to jump to.
 */
export function CommandPalette({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const { data: ideas = [] } = useIdeas();
  const { data: notes = [] } = useNotes();
  const { data: folders = [] } = useFolders();
  const { data: tasks = [] } = useTasks();
  const { data: resources = [] } = useResources();

  useEffect(() => {
    if (!visible) setQ("");
  }, [visible]);
  useEffect(() => setIndex(0), [q]);

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return PAGES;
    const today = todayKey();
    const out: Hit[] = [];
    for (const t of tasks) {
      if (!t.title.toLowerCase().includes(needle) && !t.notes?.toLowerCase().includes(needle)) continue;
      const when = t.due_date ? `${capitalize(relativeDayLabel(t.due_date, today))}${t.due_time ? ` ${formatTime12(t.due_time)}` : ""}` : "No date";
      out.push({
        key: `task:${t.id}`,
        title: t.title,
        detail: [t.status === "complete" ? "Done" : when, snippet(t.notes, needle)].filter(Boolean).join(" · "),
        type: "Task",
        icon: SquareCheckBig,
        route: `/task/${t.id}`,
      });
    }
    for (const n of notes) {
      if (n.is_archived || !noteMatches(n, needle)) continue;
      const body = n.content.map((b) => ("text" in b ? b.text : "")).join(" ");
      const folder = folders.find((f) => f.id === n.folder_id)?.name;
      const tag = n.tags.find((t) => t.toLowerCase().includes(needle));
      out.push({
        key: `note:${n.id}`,
        title: noteTitle(n),
        detail: [folder ?? "Notes", snippet(body, needle) ?? (tag ? `#${tag}` : null)].filter(Boolean).join(" · "),
        type: "Note",
        icon: FileText,
        route: `/note/${n.id}`,
      });
    }
    for (const i of ideas) {
      if (i.is_archived || i.status === "dropped") continue;
      const body = i.content.map((b) => ("text" in b ? b.text : "")).join(" ");
      const tag = i.tags.find((t) => t.toLowerCase().includes(needle));
      const inBody = snippet(body, needle);
      if (!i.title.toLowerCase().includes(needle) && !tag && !inBody) continue;
      out.push({
        key: `idea:${i.id}`,
        title: i.title,
        detail: [capitalize(i.status), inBody ?? (tag ? `#${tag}` : null)].filter(Boolean).join(" · "),
        type: "Idea",
        icon: Lightbulb,
        route: `/idea/${i.id}`,
      });
    }
    for (const r of resources) {
      if (r.is_archived) continue;
      if (![r.title, r.url, r.body, r.domain].some((v) => v?.toLowerCase().includes(needle))) continue;
      out.push({
        key: `res:${r.id}`,
        title: r.title ?? r.body?.slice(0, 80) ?? r.url ?? "Untitled",
        detail: [r.domain ?? (r.type === "text" ? "Snippet" : capitalize(r.type)), snippet(r.body, needle)].filter(Boolean).join(" · "),
        type: "Resource",
        icon: Bookmark,
        route: "/resources",
        url: r.url,
      });
    }
    return out.slice(0, 30);
  }, [q, ideas, notes, folders, tasks, resources]);

  const open = (hit: Hit) => {
    onClose();
    // A resource with a link opens it (what tapping its card does); text resources fall back to the list.
    if (hit.type === "Resource" && hit.url) {
      void openExternal(hit.url);
      return;
    }
    router.push(hit.route as never);
  };

  // Keys (web): Esc closes; ↑ ↓ move through the results; Enter opens the highlighted one.
  const state = useRef({ hits, index });
  state.current = { hits, index };
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      const { hits: list, index: i } = state.current;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (list.length === 0) return;
        const next = (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        setIndex(next);
        scroller.current?.scrollTo({ y: Math.max(0, next * 52 - 104), animated: false });
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [visible, onClose]);

  const typed = q.trim() !== "";

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={vars(themeVars)} className="flex-1 items-center px-6 pt-[12vh]">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} accessibilityLabel="Close search" />
        <View
          className="border-line bg-elev w-full max-w-[600px] overflow-hidden rounded-[16px] border"
          style={{ shadowColor: "#1B2131", shadowOpacity: 0.24, shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 20 }}
        >
          <View className="border-line flex-row items-center gap-3 border-b px-4" style={{ height: 52 }}>
            <Search size={17} color={c.ink3} strokeWidth={2} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Search tasks, notes, ideas, resources…"
              placeholderTextColor={c.ink3}
              accessibilityLabel="Search everything"
              onSubmitEditing={() => hits[index] && open(hits[index])}
              className="text-ink flex-1 text-[16px]"
              style={{ paddingVertical: 0, outlineWidth: 0 } as object}
            />
          </View>

          <ScrollView ref={scroller} className="max-h-[400px]" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 6 }}>
            {!typed && <Text className="text-ink-3 px-2.5 pb-1 pt-1.5 text-[12px] font-semibold">Jump to</Text>}
            {typed && hits.length === 0 ? (
              <View className="items-center px-4 py-8">
                <Text className="text-ink text-[14px] font-semibold">Nothing matches “{q.trim()}”</Text>
                <Text className="text-ink-3 mt-1 text-[13px]">Search looks in titles, the text inside, tags and sites.</Text>
              </View>
            ) : (
              hits.map((h, i) => {
                const on = i === index;
                return (
                  <Pressable
                    key={h.key}
                    onPress={() => open(h)}
                    onHoverIn={() => setIndex(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className={`flex-row items-center gap-3 rounded-[10px] px-2.5 ${on ? "bg-accent/[0.1]" : ""}`}
                    style={{ height: 52 }}
                  >
                    <View className={`h-8 w-8 items-center justify-center rounded-[9px] ${on ? "bg-accent/[0.14]" : "bg-chip"}`}>
                      <h.icon size={15} color={on ? c.accent : c.ink2} strokeWidth={2} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-ink text-[14.5px] font-medium">
                        {h.title}
                      </Text>
                      {h.detail ? (
                        <Text numberOfLines={1} className="text-ink-3 mt-0.5 text-[12.5px]">
                          {h.detail}
                        </Text>
                      ) : null}
                    </View>
                    {on ? <CornerDownLeft size={14} color={c.accent} strokeWidth={2.2} /> : <Text className="text-ink-3 text-[12px]">{h.type}</Text>}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {Platform.OS === "web" && (
            <View className="border-line flex-row items-center gap-4 border-t px-4 py-2">
              {[
                ["↑ ↓", "to move"],
                ["Enter", "to open"],
                ["Esc", "to close"],
              ].map(([k, label]) => (
                <View key={k} className="flex-row items-center gap-1.5">
                  <View className="bg-chip border-line rounded-[5px] border px-1.5 py-[1px]">
                    <Text className="text-ink-2 text-[11px] font-semibold">{k}</Text>
                  </View>
                  <Text className="text-ink-3 text-[12px]">{label}</Text>
                </View>
              ))}
              <View className="flex-1" />
              {typed && hits.length > 0 && (
                <Text style={{ fontVariant: ["tabular-nums"] }} className="text-ink-3 text-[12px]">
                  {hits.length} result{hits.length === 1 ? "" : "s"}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
