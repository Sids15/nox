import { useSyncStatus, useThemeColors } from "@nox/features";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsDesktop } from "../lib/use-responsive";

/**
 * Slim top strip shown only when the device is offline or writes are still queued — so the user knows
 * their edits are saved locally and will sync. Hidden when online + idle, and on desktop (where the
 * StatusBar already carries the sync chip). Uses the active theme tokens; no dedicated palette.
 */
export function SyncBanner() {
  const { online, pending } = useSyncStatus();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const c = useThemeColors();

  if (isDesktop || (online && pending === 0)) return null;

  const plural = pending === 1 ? "" : "s";
  const label = !online
    ? pending > 0
      ? `Offline · ${pending} change${plural} queued`
      : "Offline · changes will sync when you reconnect"
    : `Syncing ${pending} change${plural}…`;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.surface }}>
      <View className="border-line flex-row items-center justify-center gap-2 border-b py-1.5">
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: online ? c.accent : c.ink3 }} />
        <Text className="text-ink-2 text-[12px] font-medium">{label}</Text>
      </View>
    </View>
  );
}
