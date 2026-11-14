import { useFolders, useIdeas, useNotes, useResources, useSyncStatus, useTags, useTasks, useThemeColors } from "@nox/features";
import { todayKey } from "@nox/utils";
import { usePathname } from "expo-router";
import { Text, View } from "react-native";
import { MODULE_CHORD, SEARCH_CHORD } from "./sidebar";

/** Offline / queued-write indicator; renders nothing when online with nothing queued. */
function SyncChip() {
  const { online, queued } = useSyncStatus();
  const c = useThemeColors();
  // Keyed off queued, not pending: an in-flight write is already reflected optimistically, so
  // showing it here would blink the chip on every tap.
  if (online && queued === 0) return null;
  const label = !online ? (queued > 0 ? `Offline · ${queued} queued` : "Offline") : `Syncing ${queued}…`;
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: online ? c.accent : c.ink3 }} />
      <Text className="text-ink-3 text-[10px] font-medium tracking-[0.04em]">{label}</Text>
    </View>
  );
}

/**
 * Desktop status strip: live facts about the current module on the left, quiet keyboard hints on
 * the right. The kind of chrome that makes a window feel like an application, not a page.
 */
export function StatusBar() {
  const pathname = usePathname();
  const { data: ideas = [] } = useIdeas();
  const { data: notes = [] } = useNotes();
  const { data: folders = [] } = useFolders();
  const { data: tasks = [] } = useTasks();
  const { data: resources = [] } = useResources();
  const { data: tags = [] } = useTags();

  let summary = "";
  if (pathname === "/tasks") {
    const open = tasks.filter((t) => t.status !== "complete");
    const overdue = open.filter(
      (t) => t.due_date !== null && t.due_date < todayKey() && !(t.repeat !== "none" && t.origin_task_id === null),
    ).length;
    summary = `${open.length} open${overdue > 0 ? ` · ${overdue} overdue` : ""}`;
  } else if (pathname === "/notes") {
    const active = notes.filter((n) => !n.is_archived);
    summary = `${active.length} notes · ${folders.length} folders`;
  } else if (pathname === "/resources") {
    summary = `${resources.filter((r) => !r.is_archived).length} saved · ${tags.length} tags`;
  } else {
    const live = ideas.filter((i) => !i.is_archived && i.status !== "dropped");
    const exploring = live.filter((i) => i.status === "exploring").length;
    summary = `${live.length} ideas${exploring > 0 ? ` · ${exploring} exploring` : ""}`;
  }

  return (
    <View className="border-line bg-surface h-[26px] flex-row items-center justify-between border-t px-4">
      <Text className="text-ink-3 text-[10px] font-medium tracking-[0.04em]">{summary}</Text>
      <View className="flex-row items-center gap-4">
        <SyncChip />
        <Text className="text-ink-3 text-[10px] font-medium tracking-[0.04em]">
          {SEARCH_CHORD} search · {MODULE_CHORD} modules
        </Text>
      </View>
    </View>
  );
}
