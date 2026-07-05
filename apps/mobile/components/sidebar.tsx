import { useAuth, useIdeas, useNotes, useResources, useTasks, useThemeColors } from "@nox/features";
import { displayNameFrom, initialsFrom } from "@nox/utils";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import { Bookmark, FileText, Lightbulb, Search, SlidersHorizontal, SquareCheckBig, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, Text, View } from "react-native";
import { clockLabel, greeting, skyColor, useClock } from "../lib/use-clock";
import { CommandPalette } from "./command-palette";

type NavItem = { label: string; icon: LucideIcon; path: string; count: number };

const IS_MAC_WEB =
  Platform.OS === "web" && typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
/** The palette shortcut as the user's OS actually types it (⌘K is a lie on Windows). */
export const SEARCH_CHORD = IS_MAC_WEB ? "⌘K" : "Ctrl K";
/** Module-switch chord hint (Alt — Ctrl/⌘+digits belong to the browser's tabs). */
export const MODULE_CHORD = IS_MAC_WEB ? "⌥ 1–4" : "Alt 1–4";

const NAV_PATHS = ["/", "/notes", "/tasks", "/resources"] as const;

/** The sync dot breathes — a slow 2.6s pulse that says "connected" without saying anything. */
function BreathingDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: color, opacity }} />;
}

/**
 * Desktop rail. The wordmark's dot is the sky right now (violet at night — Nox at night is itself,
 * gold by day, ember at dusk), with a matching faint crown gradient and an hour-true greeting under
 * a live clock. Alt+1–4 switches modules; Ctrl/⌘K opens search.
 */
export function Sidebar() {
  const c = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const now = useClock();

  const { data: ideas = [] } = useIdeas();
  const { data: notes = [] } = useNotes();
  const { data: tasks = [] } = useTasks();
  const { data: resources = [] } = useResources();

  // Keyboard: Ctrl/⌘K → search; Alt+1–4 → modules (web only).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const n = Number.parseInt(e.key, 10);
        if (n >= 1 && n <= NAV_PATHS.length) {
          e.preventDefault();
          router.navigate(NAV_PATHS[n - 1]!);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const nav: NavItem[] = [
    { label: "Ideas", icon: Lightbulb, path: "/", count: ideas.filter((i) => !i.is_archived && i.status !== "dropped").length },
    { label: "Notes", icon: FileText, path: "/notes", count: notes.filter((n) => !n.is_archived).length },
    { label: "Tasks", icon: SquareCheckBig, path: "/tasks", count: tasks.filter((t) => t.status !== "complete").length },
    { label: "Resources", icon: Bookmark, path: "/resources", count: resources.filter((r) => !r.is_archived).length },
  ];

  const email = session?.user?.email ?? "";
  const name = displayNameFrom(email);
  const sky = skyColor(now, c.accent);

  return (
    <View className="bg-surface border-line w-[232px] border-r px-3 pb-3.5 pt-4">
      {/* The sky faintly colors the sidebar's crown — dawn, day, dusk, night. */}
      <LinearGradient
        colors={[`${sky}17`, "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130, pointerEvents: "none" }}
      />

      {/* Logomark + sky dot + live clock */}
      <View className="flex-row items-center justify-between px-2 pb-1">
        <View className="flex-row items-center gap-2">
          <Image
            source={require("../assets/nox-logo.png")}
            style={{ width: 48, height: 28 }}
            resizeMode="contain"
            accessibilityLabel="Nox"
          />
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              backgroundColor: sky,
              shadowColor: sky,
              shadowOpacity: 0.9,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        </View>
        <Text className="text-ink-3 font-mono text-[11px] font-medium">{clockLabel(now)}</Text>
      </View>
      <Text className="text-ink-2 px-2 pb-3.5 text-[12px]">{greeting(now, name)}</Text>

      {/* Search */}
      <Pressable
        onPress={() => setSearchOpen(true)}
        className="bg-chip border-line hover:bg-elev mb-2.5 h-[34px] flex-row items-center gap-2.5 rounded-[9px] border px-[11px]"
      >
        <Search size={13} color={c.ink3} strokeWidth={1.8} />
        <Text className="text-ink-3 flex-1 text-[12.5px]">Search</Text>
        <View className="bg-bg border-line rounded-[5px] border px-[5px] py-[3px]">
          <Text className="text-ink-3 font-mono text-[10px] font-semibold">{SEARCH_CHORD}</Text>
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
              className={`flex-row items-center gap-2.5 rounded-[10px] px-[11px] py-2 ${active ? "bg-accent/[0.12]" : "hover:bg-chip"}`}
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
        <BreathingDot color={c.success} />
        <Text className="text-ink-2 flex-1 text-[12px]">Synced</Text>
        <Text className="text-ink-3 font-mono text-[9.5px] font-medium">supabase</Text>
      </View>

      {/* Profile */}
      <Pressable
        onPress={() => router.push("/settings")}
        className="bg-chip border-line hover:bg-elev flex-row items-center gap-2.5 rounded-[10px] border px-[11px] py-[9px]"
      >
        <View className="bg-accent/[0.18] h-7 w-7 items-center justify-center rounded-full">
          <Text className="text-accent text-[10.5px] font-bold">{initialsFrom(email)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-ink text-[12.5px] font-semibold">{name}</Text>
          <Text className="text-ink-3 text-[10.5px]">{email || "not signed in"}</Text>
        </View>
        <SlidersHorizontal size={14} color={c.ink3} strokeWidth={1.7} />
      </Pressable>

      <CommandPalette visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}
