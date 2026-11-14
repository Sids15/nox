import { useAuth, usePrefs, useThemeColors, type NotifKey } from "@nox/features";
import { accents, type AccentName, type ThemeName } from "@nox/ui";
import Constants from "expo-constants";
import { capitalize as cap, displayNameFrom, initialsFrom } from "@nox/utils";
import { useRouter } from "expo-router";
import { BellRing, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Alert } from "../lib/alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sidebar } from "../components/sidebar";
import { SegmentedControl } from "../components/tasks/segmented-control";
import { useSyncLabel } from "../lib/use-sync-label";
import { ensurePermission, sendTestNotification } from "../lib/notifications";
import { useIsDesktop } from "../lib/use-responsive";
import { goBack } from "../lib/go-back";

const ACCENT_ORDER: AccentName[] = ["violet", "green", "coral", "blue"];
const THEMES: ThemeName[] = ["dark", "light"];
/** From app.json rather than a hard-coded string that drifted from the real release. */
const APP_VERSION = Constants.expoConfig?.version ?? "dev";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-ink-3 mb-2 mt-6 pl-0.5 font-mono text-[10px] font-semibold tracking-[0.14em]">
      {children}
    </Text>
  );
}

/** 46×28 pill toggle (handoff): accent when on, chip + hairline when off. */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 46,
        height: 28,
        borderRadius: 99,
        padding: 2,
        justifyContent: "center",
        alignItems: value ? "flex-end" : "flex-start",
        backgroundColor: value ? c.accent : c.chip,
        borderWidth: value ? 0 : 1,
        borderColor: c.line,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 99,
          backgroundColor: value ? "#FFFFFF" : c.ink3,
        }}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const isDesktop = useIsDesktop();
  const { session, signOut } = useAuth();
  const { theme, accent, morningSummary, endOfDayPrompt, taskReminders, setTheme, setAccent, setNotif } =
    usePrefs();

  const sync = useSyncLabel();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const email = session?.user?.email ?? "";
  const name = displayNameFrom(email);

  const handleSignOut = async () => {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
    } finally {
      setSigningOut(false);
    }
  };

  // Turning a notification on requires permission; if it's denied, keep the toggle off and point the
  // user to system settings. Turning off is always allowed.
  const sendTest = async () => {
    await sendTestNotification();
    Alert.alert(
      "Test sent",
      "If no notification appears in a few seconds, check that notifications are enabled for Nox in your system settings (and that Focus Assist / Do Not Disturb is off).",
    );
  };

  const notif = async (key: NotifKey, value: boolean) => {
    if (value && !(await ensurePermission())) {
      Alert.alert(
        "Notifications are off",
        "Enable notifications for Nox in your system settings to use reminders.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    setNotif(key, value);
  };

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <View className="flex-1 flex-row">
      {isDesktop && <Sidebar />}
      <View className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 40, maxWidth: 620, width: "100%", alignSelf: "center", ...(isDesktop ? { paddingTop: 26 } : null) }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-screen flex-row items-center gap-3 pt-2">
          <Pressable
            onPress={() => goBack("/tasks")}
            hitSlop={8}
            accessibilityLabel="Go back"
            className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center"
          >
            <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
          </Pressable>
          <Text className="text-ink text-2xl font-bold tracking-[-0.02em]">Settings</Text>
        </View>

        {/* Profile card */}
        <Pressable
          onPress={() => router.push("/account")}
          accessibilityLabel="Account"
          className="mx-[20px] border-line bg-surface rounded-card mt-4 flex-row items-center gap-[13px] border p-[14px]"
        >
          <View className="bg-accent/[0.18] h-11 w-11 items-center justify-center rounded-full">
            <Text className="text-accent text-[15px] font-bold">{initialsFrom(email)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-ink text-[15.5px] font-semibold">{name}</Text>
            <Text className="text-ink-3 mt-0.5 text-[12px]">{email || "not signed in"}</Text>
          </View>
          <ChevronRight size={16} color={c.ink3} strokeWidth={2} />
        </Pressable>

        {/* Appearance */}
        <View className="px-screen">
          <SectionLabel>APPEARANCE</SectionLabel>
        </View>
        <View className="mx-[20px] border-line bg-surface rounded-card overflow-hidden border">
          {/* Both choices visible at once. This used to be a row reading "Dark ›" that flipped the
              theme on tap — the chevron promised a screen that never opened. */}
          <View className="border-line flex-row items-center border-b px-[14px] py-[9px]">
            <Text className="text-ink flex-1 text-[14.5px]">Theme</Text>
            <View style={{ width: 176 }}>
              <SegmentedControl
                value={theme}
                onChange={setTheme}
                options={THEMES.map((t) => ({ value: t, label: cap(t) }))}
              />
            </View>
          </View>
          <View className="flex-row items-center px-[14px] py-[13px]">
            <Text className="text-ink flex-1 text-[14.5px]">Accent</Text>
            <View className="flex-row items-center gap-[9px]">
              {ACCENT_ORDER.map((a) => {
                const selected = a === accent;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setAccent(a)}
                    accessibilityLabel={`${a} accent`}
                    accessibilityState={{ selected }}
                    style={{
                      borderRadius: 99,
                      borderWidth: 1.5,
                      padding: 2.5,
                      borderColor: selected ? accents[a] : "transparent",
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: accents[a] }} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View className="px-screen">
          <SectionLabel>NOTIFICATIONS</SectionLabel>
        </View>
        <View className="mx-[20px] border-line bg-surface rounded-card overflow-hidden border">
          <View className="border-line flex-row items-center border-b px-[14px] py-3">
            <View className="flex-1">
              <Text className="text-ink text-[14.5px]">Morning summary</Text>
              <Text className="text-ink-3 mt-0.5 font-mono text-[10.5px]">8:00 AM</Text>
            </View>
            <Toggle value={morningSummary} onChange={(v) => notif("morningSummary", v)} />
          </View>
          <View className="border-line flex-row items-center border-b px-[14px] py-3">
            <View className="flex-1">
              <Text className="text-ink text-[14.5px]">End-of-day prompt</Text>
              <Text className="text-ink-3 mt-0.5 font-mono text-[10.5px]">9:00 PM · plan tomorrow</Text>
            </View>
            <Toggle value={endOfDayPrompt} onChange={(v) => notif("endOfDayPrompt", v)} />
          </View>
          <View className="border-line flex-row items-center border-b px-[14px] py-3">
            <Text className="text-ink flex-1 text-[14.5px]">Task reminders</Text>
            <Toggle value={taskReminders} onChange={(v) => notif("taskReminders", v)} />
          </View>
          <Pressable onPress={sendTest} className="flex-row items-center px-[14px] py-3">
            <View className="flex-1">
              <Text className="text-ink text-[14.5px]">Send test notification</Text>
              <Text className="text-ink-3 mt-0.5 text-[11.5px]">Check that reminders can reach you</Text>
            </View>
            <BellRing size={16} color={c.accent} strokeWidth={1.9} />
          </Pressable>
        </View>

        {/* Sync */}
        <View className="px-screen">
          <SectionLabel>SYNC</SectionLabel>
        </View>
        <View className="mx-[20px] border-line bg-surface rounded-card overflow-hidden border">
          <View className="flex-row items-center gap-[10px] px-[14px] py-3">
            <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: sync.color }} />
            <Text className="text-ink flex-1 text-[14.5px] font-medium">{sync.title}</Text>
            <Text className="text-ink-3 font-mono text-[10.5px]">{sync.detail ?? "all changes saved"}</Text>
          </View>
        </View>

        {/* Sign out */}
        <View className="px-screen mt-4">
          <Pressable
            disabled={signingOut}
            onPress={handleSignOut}
            className="bg-high/[0.09] items-center rounded-[14px] py-[13px]"
          >
            <Text className="text-high text-[14px] font-semibold">Sign out</Text>
          </Pressable>
          {error ? <Text className="text-high mt-2 text-center text-[13px]">{error}</Text> : null}
        </View>

        <Text className="text-ink-3 mt-3 text-center font-mono text-[10px]">nox {APP_VERSION}</Text>
      </ScrollView>
      </View>
      </View>
    </SafeAreaView>
  );
}
