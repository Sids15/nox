import "react-native-gesture-handler";
import "react-native-url-polyfill/auto";
import "../global.css";

import { queryClient, queryPersister, setupOnlineManager } from "@nox/db";
import {
  registerMutationDefaults,
  useAuthBootstrap,
  usePrefs,
  useRealtimeSync,
  useSessionStore,
  useThemeColors,
  useThemeVars,
} from "@nox/features";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colorScheme, vars } from "nativewind";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initSentry } from "../lib/sentry";
import { DialogHost } from "../components/dialog-host";
import { SyncChrome } from "../components/sync-banner";
import { useAuthDeepLink } from "../lib/use-auth-deeplink";
import { useNotifications } from "../lib/use-notifications";

initSentry();
// Wire real connectivity so offline writes pause (queue) instead of failing, and register every
// write's network function by key so a persisted, queued write can resume after an app restart.
setupOnlineManager();
registerMutationDefaults(queryClient);

/**
 * Applies the active theme at runtime: the NativeWind `vars()` map drives every class-based color,
 * `colorScheme` + `StatusBar` keep native chrome in sync. Theme/accent come from the persisted prefs
 * store, so toggling in Settings re-themes the whole app instantly. (Expo Go ignores app.json's
 * userInterfaceStyle, so we drive appearance ourselves rather than relying on the OS.)
 */
function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = usePrefs((s) => s.theme);
  const themeVars = useThemeVars();

  useEffect(() => {
    colorScheme.set(theme);
  }, [theme]);

  return (
    <View style={[{ flex: 1 }, vars(themeVars)]}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      {children}
    </View>
  );
}

/** Mounts the notification scheduler only while authed (it reads the tasks query). Renders nothing. */
function NotificationsBridge() {
  useNotifications();
  return null;
}

function RootNavigator() {
  useAuthBootstrap();
  useAuthDeepLink();
  useRealtimeSync();
  const status = useSessionStore((s) => s.status);
  const prefsHydrated = usePrefs((s) => s.hydrated);
  const c = useThemeColors();

  // Wait for persisted prefs before painting content, so the app never flashes the default
  // dark/violet theme before the user's saved theme/accent load.
  if (status === "loading" || !prefsHydrated) {
    return (
      <View className="bg-bg flex-1 items-center justify-center">
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {status === "authenticated" && <NotificationsBridge />}
      <SyncChrome>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="auth-callback" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="account" />
          <Stack.Screen name="task/[id]" />
          <Stack.Screen name="idea/[id]" />
          <Stack.Screen name="note/[id]" />
          <Stack.Screen name="folder/[id]" />
        </Stack>
      </SyncChrome>
      {/* Renders Alert.alert() as a themed dialog on web; renders nothing on native. */}
      <DialogHost />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            // Persist only paused (offline-queued) writes — the ones resumePausedMutations can
            // actually resume. Persisting an in-flight mutation would leave it stuck "pending"
            // forever after a mid-flight kill (never paused, so never resumed), inflating the
            // sync indicator permanently.
            dehydrateOptions: { shouldDehydrateMutation: (m) => m.state.isPaused },
          }}
          onSuccess={() => {
            // Cache rehydrated on launch — flush any writes that were queued before the last exit.
            void queryClient.resumePausedMutations();
          }}
        >
          <SafeAreaProvider>
            <RootNavigator />
          </SafeAreaProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
