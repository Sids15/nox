import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { Platform } from "react-native";

/**
 * Wire TanStack's `onlineManager` to real device connectivity on native. Without this, react-query
 * assumes it is always online, so a write made offline fails immediately (after its retries) and its
 * `onError` rolls the optimistic change back — the edit is lost. With connectivity wired, an offline
 * write instead PAUSES (see the mutations' `networkMode: "offlineFirst"` in query.ts) and resumes on
 * reconnect. On web, `onlineManager` already tracks `navigator.onLine`, so we leave its default.
 * Call once at app startup.
 */
export function setupOnlineManager(): void {
  if (Platform.OS === "web") return;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // isInternetReachable is null while unknown — treat unknown-but-connected as online.
      setOnline(Boolean(state.isConnected && (state.isInternetReachable ?? true)));
    }),
  );
}
