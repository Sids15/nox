import { inboxItems, useIdeas, useNotes, usePrefs, useResources, useSpaces, useTasks, useThemeColors } from "@nox/features";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import { usePathname, useRouter } from "expo-router";
import { Bookmark, CalendarCheck, ChartColumn, FileText, Inbox, Layers, Timer, Lightbulb, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings2, SquareCheckBig, type LucideIcon } from "lucide-react-native";
import { addDays, formatTime12, toDateKey } from "@nox/utils";
import { TABULAR } from "./menu";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { ResizablePane } from "./resizable-pane";
import { clockLabel, greeting, skyColor, useClock } from "../lib/use-clock";
import { useIdentity } from "../lib/use-identity";
import { useSyncLabel } from "../lib/use-sync-label";
import { CommandPalette } from "./command-palette";
import { NewSpaceDialog } from "./brain/new-space-dialog";
import { SpaceMark } from "./brain/space-mark";

type NavItem = { label: string; icon: LucideIcon; path: string; count: number; dot?: boolean };

const IS_MAC_WEB =
  Platform.OS === "web" && typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
/** The palette shortcut as the user's OS actually types it (⌘K is a lie on Windows). */
export const SEARCH_CHORD = IS_MAC_WEB ? "⌘K" : "Ctrl K";
/** Module-switch chord hint (Alt — Ctrl/⌘+digits belong to the browser's tabs). */
export const MODULE_CHORD = IS_MAC_WEB ? "⌥ 1–5" : "Alt 1–5";

const NAV_PATHS = ["/", "/notes", "/tasks", "/resources", "/spaces"] as const;
/**
 * Where each module really lives. The bare "/" is claimed twice — by the Ideas tab and by the root
 * redirect (which sends a signed-in user to Tasks) — so from a page outside the tabs (Settings,
 * Account, an open note) "Ideas" landed on Tasks. The group-qualified path is unambiguous.
 */
const hrefFor = (path: string) => (path === "/" ? "/(tabs)" : `/(tabs)${path}`);

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
 * Desktop rail. A faint crown gradient carries the sky right now (violet at night — Nox at night is
 * itself, gold by day, ember at dusk), over an hour-true greeting and a live clock. Alt+1–5 switches
 * modules; Ctrl/⌘K opens search.
 */
export function Sidebar() {
  const c = useThemeColors();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const now = useClock();
  const sync = useSyncLabel();

  const { data: ideas = [] } = useIdeas();
  const { data: notes = [] } = useNotes();
  const { data: tasks = [] } = useTasks();
  const { data: resources = [] } = useResources();
  const { data: allSpaces = [] } = useSpaces();
  const spaces = allSpaces.filter((s) => !s.archived);
  const [newSpace, setNewSpace] = useState(false);
  // Collapsed to an icon rail: the user's choice, else automatically on narrower windows (an iPad
  // in landscape, a half-screen window) so the page gets the room.
  const { width: winWidth } = useWindowDimensions();
  const collapsedPref = usePrefs((s) => s.sidebarCollapsed);
  const setCollapsed = usePrefs((s) => s.setSidebarCollapsed);
  const lastReviewed = usePrefs((s) => s.lastReviewed);
  const collapsed = collapsedPref ?? winWidth < 1100;

  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  // A screen opened on top (a space, a note) has its own sidebar while this one stays mounted
  // underneath. Only the sidebar on screen answers the keyboard — two of them used to open two search
  // boxes at once, so it took two clicks outside to get back to the app.
  const onScreen = useIsFocused();
  // Keyboard: Ctrl/⌘K → search; Ctrl/⌘\ → collapse the sidebar; Alt+1–5 → modules (web only).
  useEffect(() => {
    if (Platform.OS !== "web" || !onScreen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsed(!collapsedRef.current);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        // `code`, not `key`: on macOS Option+digit types a symbol (⌥1 → "¡"), so `key` is never a
        // digit there and the shortcut the status bar advertises silently did nothing.
        const n = /^Digit[1-9]$/.test(e.code) ? Number(e.code.slice(5)) : 0;
        if (n >= 1 && n <= NAV_PATHS.length) {
          e.preventDefault();
          router.navigate(hrefFor(NAV_PATHS[n - 1]!) as never);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, onScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav: NavItem[] = [
    { label: "Ideas", icon: Lightbulb, path: "/", count: ideas.filter((i) => !i.is_archived && i.status !== "dropped").length },
    { label: "Notes", icon: FileText, path: "/notes", count: notes.filter((n) => !n.is_archived).length },
    { label: "Tasks", icon: SquareCheckBig, path: "/tasks", count: tasks.filter((t) => t.status !== "complete").length },
    { label: "Resources", icon: Bookmark, path: "/resources", count: resources.filter((r) => !r.is_archived).length },
    { label: "Spaces", icon: Layers, path: "/spaces", count: spaces.length },
  ];

  // Plan: the pages around your tasks (Inbox first: what still needs sorting).
  const tools: NavItem[] = [
    { label: "Inbox", icon: Inbox, path: "/inbox", count: inboxItems({ tasks, notes, ideas, resources }).length },
    { label: "Focus", icon: Timer, path: "/focus", count: 0 },
    // A dot once a week has passed since the last review.
    { label: "Review", icon: CalendarCheck, path: "/review", count: 0, dot: !lastReviewed || lastReviewed <= addDays(toDateKey(now), -7) },
    { label: "Insights", icon: ChartColumn, path: "/insights", count: 0 },
  ];

  const { name, firstName, initials } = useIdentity();
  const today = toDateKey(now);
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todays = tasks.filter((t) => t.status !== "complete" && (t.due_date === today || t.due_date === null));
  const leftToday = todays.length;
  const upNext = todays
    .filter((t) => t.due_date === today && t.due_time && t.due_time.slice(0, 5) >= nowHHMM)
    .sort((a, b) => a.due_time!.localeCompare(b.due_time!))
    .slice(0, 4);
  const sky = skyColor(now, c.accent);

  if (collapsed) {
    return (
      <View className="bg-surface border-line w-[64px] items-center border-r pb-3 pt-4">
        <Pressable onPress={() => setCollapsed(false)} accessibilityRole="button" accessibilityLabel="Expand the sidebar" {...({ title: "Expand sidebar (Ctrl/⌘ \\)" } as object)} className="hover:bg-chip mb-2 h-10 w-10 items-center justify-center rounded-[10px]">
          <PanelLeftOpen size={18} color={c.ink2} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={() => setSearchOpen(true)} accessibilityRole="button" accessibilityLabel="Search" className="hover:bg-chip mb-3 h-10 w-10 items-center justify-center rounded-[10px]">
          <Search size={18} color={c.ink3} strokeWidth={2} />
        </Pressable>
        <ScrollView className="w-full flex-1" contentContainerStyle={{ alignItems: "center", gap: 2, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          {nav.map((item) => {
            const active = pathname === item.path;
            return (
              <Pressable
                key={item.path}
                onPress={() => router.navigate(hrefFor(item.path) as never)}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item.label}, ${item.count}`}
                {...({ title: item.label } as object)}
                className={`h-11 w-11 items-center justify-center rounded-[11px] ${active ? "bg-accent/[0.1]" : "hover:bg-chip"}`}
              >
                <item.icon size={19} color={active ? c.accent : c.ink3} strokeWidth={active ? 2.1 : 1.9} />
              </Pressable>
            );
          })}
          <View className="bg-line my-2 h-px w-8" />
          {tools.map((item) => {
            const active = pathname === item.path;
            return (
              <Pressable
                key={item.path}
                onPress={() => router.navigate(item.path as never)}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item.label}, ${item.count}`}
                {...({ title: item.label } as object)}
                className={`h-11 w-11 items-center justify-center rounded-[11px] ${active ? "bg-accent/[0.1]" : "hover:bg-chip"}`}
              >
                <item.icon size={19} color={active ? c.accent : c.ink3} strokeWidth={active ? 2.1 : 1.9} />
                {item.count > 0 || item.dot ? <View style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} /> : null}
              </Pressable>
            );
          })}
          {spaces.length > 0 ? <View className="bg-line my-2 h-px w-8" /> : null}
          {spaces.map((sp) => {
            const active = pathname === `/space/${sp.id}`;
            return (
              <Pressable key={sp.id} onPress={() => router.navigate(`/space/${sp.id}` as never)} accessibilityRole="link" accessibilityLabel={sp.name} {...({ title: sp.name } as object)} className={`h-11 w-11 items-center justify-center rounded-[11px] ${active ? "bg-accent/[0.1]" : "hover:bg-chip"}`}>
                <SpaceMark space={sp} size={24} />
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel={`Settings. ${name}, ${sync.title}`} className="hover:bg-chip h-11 w-11 items-center justify-center rounded-full">
          <View className="bg-accent/[0.14] h-8 w-8 items-center justify-center rounded-full">
            <Text className="text-accent text-[12px] font-semibold">{initials}</Text>
          </View>
          <View style={{ position: "absolute", right: 4, bottom: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: sync.color }} />
        </Pressable>
        <CommandPalette visible={searchOpen} onClose={() => setSearchOpen(false)} />
        <NewSpaceDialog visible={newSpace} onClose={() => setNewSpace(false)} />
      </View>
    );
  }

  return (
    <ResizablePane id="sidebar" initial={232} min={200} max={320} className="bg-surface border-line border-r px-3 pb-3 pt-4">
      {/* The sky faintly colors the sidebar's crown — dawn, day, dusk, night. */}
      <LinearGradient
        colors={[`${sky}17`, "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130, pointerEvents: "none" }}
      />

      {/* Logomark + live clock */}
      <View className="flex-row items-center justify-between px-2 pb-1">
        {/* The wordmark asset is white-on-transparent, so it must be tinted or it disappears on the
            light theme. react-native-web composites tintColor against the alpha channel. */}
        <Image
          source={require("../assets/nox-wordmark.png")}
          style={{ width: 48, height: 28, tintColor: c.ink }}
          resizeMode="contain"
          accessibilityLabel="Nox"
        />
        <View className="flex-row items-center gap-1">
          <Text className="text-ink-3 text-[11px] font-medium">{clockLabel(now)}</Text>
          <Pressable onPress={() => setCollapsed(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Collapse the sidebar" {...({ title: "Collapse sidebar (Ctrl/⌘ \\)" } as object)} className="hover:bg-chip h-7 w-7 items-center justify-center rounded-[7px]">
            <PanelLeftClose size={15} color={c.ink3} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
      <Text numberOfLines={1} className="text-ink-2 px-2 pb-4 text-[13px]" style={{ flexShrink: 0, lineHeight: 18 }}>
        {greeting(now, firstName)}
      </Text>

      {/* Search */}
      <Pressable
        onPress={() => setSearchOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Search"
        className="bg-bg border-line hover:border-ink-3 mb-3 h-[34px] flex-row items-center gap-2.5 rounded-[9px] border px-2.5"
      >
        <Search size={14} color={c.ink3} strokeWidth={2} />
        <Text className="text-ink-3 flex-1 text-[13px]">Search</Text>
        <View className="bg-bg border-line rounded-[5px] border px-[5px] py-[3px]">
          <Text className="text-ink-3 text-[11px] font-semibold">{SEARCH_CHORD}</Text>
        </View>
      </Pressable>

      {/* Nav and Up next scroll when the window is short; the header above and the profile below
          stay put (they used to be squeezed into each other). */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
      <View className="gap-0.5">
        {nav.map((item, i) => {
          const active = pathname === item.path;
          return (
            <Pressable
              key={item.path}
              onPress={() => router.navigate(hrefFor(item.path) as never)}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label}, ${item.count}`}
              {...({ title: `${item.label} (${MODULE_CHORD.split(" ")[0]} ${i + 1})` } as object)}
              className={`h-[36px] flex-row items-center gap-3 rounded-[9px] px-2.5 ${active ? "bg-accent/[0.1]" : "hover:bg-chip"}`}
            >
              <item.icon size={16} color={active ? c.accent : c.ink3} strokeWidth={active ? 2.1 : 1.9} />
              <Text className={`flex-1 text-[14px] ${active ? "text-ink font-semibold" : "text-ink-2 font-medium"}`}>{item.label}</Text>
              {item.count > 0 && (
                <Text style={TABULAR} className={`text-[12px] ${active ? "text-accent font-semibold" : "text-ink-3"}`}>
                  {item.count}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Plan: Inbox (and the pages around your tasks) */}
      <View className="border-line mt-4 gap-0.5 border-t pt-3">
        {tools.map((item) => {
          const active = pathname === item.path;
          return (
            <Pressable
              key={item.path}
              onPress={() => router.navigate(item.path as never)}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label}, ${item.count}`}
              className={`h-[36px] flex-row items-center gap-3 rounded-[9px] px-2.5 ${active ? "bg-accent/[0.1]" : "hover:bg-chip"}`}
            >
              <item.icon size={16} color={active ? c.accent : c.ink3} strokeWidth={active ? 2.1 : 1.9} />
              <Text className={`flex-1 text-[14px] ${active ? "text-ink font-semibold" : "text-ink-2 font-medium"}`}>{item.label}</Text>
              {item.count > 0 && (
                <Text style={TABULAR} className={`text-[12px] ${active ? "text-accent font-semibold" : "text-ink-3"}`}>
                  {item.count}
                </Text>
              )}
              {item.dot && item.count === 0 ? <View accessibilityLabel="Due" style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} /> : null}
            </Pressable>
          );
        })}
      </View>

      {/* Spaces: one tap into each area of work or life */}
      <View className="border-line mt-5 border-t pt-4">
        <View className="flex-row items-center justify-between px-2.5 pb-1.5">
          <Text className="text-ink-2 text-[13px] font-semibold">Spaces</Text>
          <Pressable
            onPress={() => setNewSpace(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="New space"
            className="hover:bg-chip h-6 w-6 items-center justify-center rounded-[6px]"
          >
            <Plus size={14} color={c.ink3} strokeWidth={2.2} />
          </Pressable>
        </View>
        {spaces.length === 0 ? (
          <Pressable onPress={() => setNewSpace(true)} className="hover:bg-chip rounded-[8px] px-2.5 py-1.5">
            <Text className="text-ink-3 text-[13px] leading-[18px]">Make a space for a channel, a project or your PRDs.</Text>
          </Pressable>
        ) : (
          spaces.map((s) => {
            const active = pathname === `/space/${s.id}`;
            return (
              <Pressable
                key={s.id}
                onPress={() => router.navigate(`/space/${s.id}` as never)}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                className={`h-[32px] flex-row items-center gap-2.5 rounded-[8px] px-2.5 ${active ? "bg-accent/[0.1]" : "hover:bg-chip"}`}
              >
                <SpaceMark space={s} size={18} />
                <Text numberOfLines={1} className={`flex-1 text-[13px] ${active ? "text-ink font-semibold" : "text-ink-2 font-medium"}`}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      {/* Up next: today's next timed tasks, so the rail is useful and not just empty space */}
      <View className="border-line mt-5 border-t pt-4">
        <View className="flex-row items-center justify-between px-2.5 pb-1.5">
          <Text className="text-ink-2 text-[13px] font-semibold">Up next</Text>
          {upNext.length > 0 && (
            <Text style={TABULAR} className="text-ink-3 text-[12px]">
              {leftToday} left today
            </Text>
          )}
        </View>
        {upNext.length === 0 ? (
          <Text className="text-ink-3 px-2.5 text-[13px] leading-[18px]">
            {leftToday > 0 ? `${leftToday} to do today, none at a set time.` : "Nothing else scheduled today."}
          </Text>
        ) : (
          upNext.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.navigate("/(tabs)/tasks" as never)}
              accessibilityRole="link"
              className="hover:bg-chip flex-row items-baseline gap-2.5 rounded-[8px] px-2.5 py-1.5"
            >
              <Text style={TABULAR} className="text-ink-3 w-[52px] text-[12px]">
                {formatTime12(t.due_time)}
              </Text>
              <Text numberOfLines={1} className="text-ink flex-1 text-[13px]">
                {t.title}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      </ScrollView>

      {/* Profile, with sync state under the name */}
      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="button"
        accessibilityLabel={`Settings. ${name}, ${sync.title}`}
        className="hover:bg-chip border-line flex-row items-center gap-2.5 rounded-[10px] px-2 py-2"
        style={{ flexShrink: 0 }}
      >
        <View className="bg-accent/[0.14] h-8 w-8 items-center justify-center rounded-full">
          <Text className="text-accent text-[12px] font-semibold">{initials}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-ink text-[13px] font-medium">
            {name}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            {sync.settled ? <BreathingDot color={sync.color} /> : <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: sync.color }} />}
            <Text numberOfLines={1} className="text-ink-3 flex-1 text-[12px]">
              {sync.detail ? `${sync.title} · ${sync.detail}` : sync.title}
            </Text>
          </View>
        </View>
        <Settings2 size={15} color={c.ink3} strokeWidth={2} />
      </Pressable>

      <CommandPalette visible={searchOpen} onClose={() => setSearchOpen(false)} />
      <NewSpaceDialog visible={newSpace} onClose={() => setNewSpace(false)} />
    </ResizablePane>
  );
}
