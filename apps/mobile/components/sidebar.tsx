import { useAuth, useIdeas, useNotes, useResources, useTasks, useThemeColors } from "@nox/features";
import { displayNameFrom, initialsFrom } from "@nox/utils";
import { usePathname, useRouter } from "expo-router";
import { Bookmark, FileText, Lightbulb, Search, SlidersHorizontal, SquareCheckBig, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { CommandPalette } from "./command-palette";

type NavItem = { label: string; icon: LucideIcon; path: string; count: number };

/** The palette shortcut as the user's OS actually types it (⌘K is a lie on Windows). */
const SHORTCUT_LABEL =
  Platform.OS === "web" && typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl K";

/** Fixed 232px desktop sidebar — nav + counts + global search + profile. Replaces the tab bar on
 *  wide viewports (see components/tab-bar.tsx for the mobile equivalent). */
export function Sidebar() {
  const c = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K opens the command palette (web/desktop only).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: ideas = [] } = useIdeas();
  const { data: notes = [] } = useNotes();
  const { data: tasks = [] } = useTasks();
  const { data: resources = [] } = useResources();

  const nav: NavItem[] = [
    { label: "Ideas", icon: Lightbulb, path: "/", count: ideas.filter((i) => !i.is_archived && i.status !== "dropped").length },
    { label: "Notes", icon: FileText, path: "/notes", count: notes.filter((n) => !n.is_archived).length },
    { label: "Tasks", icon: SquareCheckBig, path: "/tasks", count: tasks.length },
    { label: "Resources", icon: Bookmark, path: "/resources", count: resources.filter((r) => !r.is_archived).length },
  ];

  const email = session?.user?.email ?? "";

  return (
    <View className="bg-surface border-line w-[232px] border-r px-3 pb-3.5 pt-4">
      {/* Wordmark */}
      <View className="flex-row items-baseline gap-0.5 px-2 pb-3">
        <Text className="text-ink text-[20px] font-extrabold tracking-[-0.04em]">nox</Text>
        <View className="bg-accent h-1.5 w-1.5 rounded-full" />
      </View>

      {/* Search */}
      <Pressable
        onPress={() => setSearchOpen(true)}
        className="bg-chip border-line mb-2.5 h-[34px] flex-row items-center gap-2.5 rounded-[9px] border px-[11px]"
      >
        <Search size={13} color={c.ink3} strokeWidth={1.8} />
        <Text className="text-ink-3 flex-1 text-[12.5px]">Search</Text>
        <View className="bg-bg border-line rounded-[5px] border px-[5px] py-[3px]">
          <Text className="text-ink-3 font-mono text-[10px] font-semibold">{SHORTCUT_LABEL}</Text>
        </View>
      </Pressable>

      {/* Nav */}
      <View className="gap-1">
        {nav.map((item) => {
          const active = pathname === item.path;
          return (
            <Pressable
              key={item.path}
              onPress={() => router.navigate(item.path)}
              className={`flex-row items-center gap-2.5 rounded-[10px] px-[11px] py-2 ${active ? "bg-accent/[0.12]" : ""}`}
            >
              <item.icon size={17} color={active ? c.accent : c.ink2} strokeWidth={1.7} />
              <Text className={`flex-1 text-[13.5px] font-semibold ${active ? "text-accent" : "text-ink-2"}`}>{item.label}</Text>
              <Text className="text-ink-3 font-mono text-[10.5px] font-medium">{item.count}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-1" />

      {/* Sync */}
      <View className="flex-row items-center gap-2 px-[11px] py-2">
        <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: c.success }} />
        <Text className="text-ink-2 flex-1 text-[12px]">Synced</Text>
        <Text className="text-ink-3 font-mono text-[9.5px] font-medium">supabase</Text>
      </View>

      {/* Profile */}
      <Pressable
        onPress={() => router.push("/settings")}
        className="bg-chip border-line flex-row items-center gap-2.5 rounded-[10px] border px-[11px] py-[9px]"
      >
        <View className="bg-accent/[0.18] h-7 w-7 items-center justify-center rounded-full">
          <Text className="text-accent text-[10.5px] font-bold">{initialsFrom(email)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-ink text-[12.5px] font-semibold">{displayNameFrom(email)}</Text>
          <Text className="text-ink-3 text-[10.5px]">{email || "not signed in"}</Text>
        </View>
        <SlidersHorizontal size={14} color={c.ink3} strokeWidth={1.7} />
      </Pressable>

      <CommandPalette visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}
