import { useIdeas, useNotes, useResources, useTasks, useThemeColors, useThemeVars } from "@nox/features";
import { useRouter } from "expo-router";
import { Bookmark, FileText, Lightbulb, Search, SquareCheckBig, type LucideIcon } from "lucide-react-native";
import { vars } from "nativewind";
import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { openExternal } from "../lib/open-external";
import { noteMatches, noteTitle } from "./notes/note-utils";

interface Hit {
  key: string;
  title: string;
  type: string;
  icon: LucideIcon;
  route: string;
  /** Resources have no detail route — open their link directly (undefined for other types). */
  url?: string | null;
}

/** Global search across all four modules (the sidebar's ⌘K). Opens on click or Ctrl/⌘+K (web). */
export function CommandPalette({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useThemeColors();
  const themeVars = useThemeVars();
  const router = useRouter();
  const [q, setQ] = useState("");

  const { data: ideas = [] } = useIdeas();
  const { data: notes = [] } = useNotes();
  const { data: tasks = [] } = useTasks();
  const { data: resources = [] } = useResources();

  // Close on Escape (web). Opening via ⌘K is owned by the sidebar (it holds `visible`).
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) setQ("");
  }, [visible]);

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out: Hit[] = [];
    for (const i of ideas) {
      if (i.is_archived || i.status === "dropped") continue;
      if (i.title.toLowerCase().includes(needle) || i.tags.some((t) => t.toLowerCase().includes(needle)))
        out.push({ key: `idea:${i.id}`, title: i.title, type: "Idea", icon: Lightbulb, route: `/idea/${i.id}` });
    }
    for (const n of notes) {
      if (n.is_archived) continue;
      if (noteMatches(n, needle)) out.push({ key: `note:${n.id}`, title: noteTitle(n), type: "Note", icon: FileText, route: `/note/${n.id}` });
    }
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(needle))
        out.push({ key: `task:${t.id}`, title: t.title, type: "Task", icon: SquareCheckBig, route: `/task/${t.id}` });
    }
    for (const r of resources) {
      if (r.is_archived) continue;
      const hay = [r.title, r.url, r.body, r.domain].some((v) => v?.toLowerCase().includes(needle));
      if (hay) out.push({ key: `res:${r.id}`, title: r.title ?? r.url ?? "Untitled", type: "Resource", icon: Bookmark, route: "/resources", url: r.url });
    }
    return out.slice(0, 30);
  }, [q, ideas, notes, tasks, resources]);

  const open = (hit: Hit) => {
    onClose();
    // A resource with a link opens it (what tapping its card does); text resources fall back to the list.
    if (hit.type === "Resource" && hit.url) {
      void openExternal(hit.url);
      return;
    }
    router.push(hit.route as never);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={vars(themeVars)} className="flex-1 items-center bg-black/60 px-6 pt-[12vh]">
        <Pressable onPress={() => {}} className="border-line bg-elev w-full max-w-[560px] overflow-hidden rounded-[14px] border">
          <View className="border-line flex-row items-center gap-2.5 border-b px-4 py-3">
            <Search size={16} color={c.ink3} strokeWidth={1.8} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="Search ideas, notes, tasks, resources…"
              placeholderTextColor={c.ink3}
              onSubmitEditing={() => hits[0] && open(hits[0])}
              className="text-ink flex-1 text-[15px]"
              style={{ paddingVertical: 0 }}
            />
          </View>
          <ScrollView className="max-h-[380px]" keyboardShouldPersistTaps="handled">
            {q.trim() === "" ? (
              <Text className="text-ink-3 px-4 py-6 text-center text-[13px]">Type to search across everything.</Text>
            ) : hits.length === 0 ? (
              <Text className="text-ink-3 px-4 py-6 text-center text-[13px]">No matches.</Text>
            ) : (
              hits.map((h) => (
                <Pressable key={h.key} onPress={() => open(h)} className="hover:bg-chip flex-row items-center gap-3 px-4 py-2.5">
                  <h.icon size={16} color={c.ink3} strokeWidth={1.7} />
                  <Text numberOfLines={1} className="text-ink flex-1 text-[14px]">{h.title}</Text>
                  <Text className="text-ink-3 font-mono text-[10px] uppercase tracking-[0.1em]">{h.type}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
