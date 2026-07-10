import { useSyncStatus, useThemeColors } from "@nox/features";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsDesktop } from "../lib/use-responsive";

/** Visible only for work the user needs to know about: offline, or writes still queued. */
function useBannerVisible(): boolean {
  const { online, queued } = useSyncStatus();
  const isDesktop = useIsDesktop();
  // Desktop carries this in the StatusBar chip instead. Never show for merely in-flight writes —
  // that would flash the bar on every tap (see useSyncStatus).
  return !isDesktop && (!online || queued > 0);
}

/**
 * Slim top strip shown only when the device is offline or writes are still queued — so the user knows
 * their edits are saved locally and will sync. Uses the active theme tokens; no dedicated palette.
 */
function SyncBanner() {
  const { online, queued } = useSyncStatus();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();

  const plural = queued === 1 ? "" : "s";
  const label = !online
    ? queued > 0
      ? `Offline · ${queued} change${plural} queued`
      : "Offline · changes will sync when you reconnect"
    : `Syncing ${queued} change${plural}…`;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.surface }}>
      <View className="border-line flex-row items-center justify-center gap-2 border-b py-1.5">
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: online ? c.accent : c.ink3 }} />
        <Text className="text-ink-2 text-[12px] font-medium">{label}</Text>
      </View>
    </View>
  );
}

/**
 * Renders the sync banner above the app and, while it's showing, zeroes the top safe-area inset for
 * everything below it. Screens each mount their own `SafeAreaView edges={["top"]}`; without this the
 * banner's `paddingTop: insets.top` and the screen's own top inset would both apply, double-padding
 * the header and visibly shoving the app down the moment the banner appears.
 */
export function SyncChrome({ children }: { children: ReactNode }) {
  const visible = useBannerVisible();
  const insets = useSafeAreaInsets();

  if (!visible) return <>{children}</>;

  return (
    <>
      <SyncBanner />
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>{children}</SafeAreaInsetsContext.Provider>
    </>
  );
}
