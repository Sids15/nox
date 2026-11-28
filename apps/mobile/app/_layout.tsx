import "react-native-gesture-handler";
import "react-native-url-polyfill/auto";
import "../global.css";

// MUST stay above the @nox/db import. Constructing the Supabase client starts detectSessionInUrl,
// which strips the auth params out of window.location; this module captures any error carried by
// the launch URL at load time, and ESM evaluates imports in order.
import "../lib/auth-url-error";

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
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { colorScheme, vars } from "nativewind";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initSentry } from "../lib/sentry";
import { DialogHost } from "../components/dialog-host";
import { SyncChrome } from "../components/sync-banner";
import { useAuthDeepLink } from "../lib/use-auth-deeplink";
import { useNotifications } from "../lib/use-notifications";
import { useHeadingFont } from "../lib/heading-font";
import { useWebViewport } from "../lib/web-viewport";
import { useAiAccountSync } from "../lib/use-ai";
import { isWidgetWindow, useOpenFromWidget } from "../lib/desktop-widget";
import { clearAndroidWidget, useAndroidShare, useAndroidWidgetSync } from "../lib/android-widget";
import { useFocusAlert } from "../lib/use-focus-alert";
import { DesktopWidget } from "../components/widget/desktop-widget";

/** This window is the desktop widget (a second Tauri window), not the app. Fixed for its lifetime. */
const WIDGET_WINDOW = isWidgetWindow();

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
  useHeadingFont();
  const { bg } = useThemeColors();
  useWebViewport(bg, theme === "dark");

  useEffect(() => {
    colorScheme.set(theme);
  }, [theme]);

  // Paint the NATIVE root view (and Android's window) in the theme background. It defaulted to
  // white, and anything that briefly or permanently uncovers it — the keyboard opening and the
  // screen resizing above it, a modal sliding in — showed as a white band. app.json's
  // backgroundColor covers launch; this keeps it right after a theme switch.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(bg).catch(() => {});
  }, [bg]);

  // bg-bg on the root guarantees the themed backdrop paints behind everything. Without it, the
  // wrapper Views are transparent and any area a screen doesn't cover shows the browser's default
  // white — which is exactly what bled through beside the content in the packaged web build. The
  // class resolves against the same --bg custom property the inline vars() sets on this element.
  return (
    <View className="bg-bg" style={[{ flex: 1 }, vars(themeVars)]}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      {children}
    </View>
  );
}

/** Mounts the notification scheduler only while authed (it reads the tasks query). Renders nothing. */
function NotificationsBridge() {
  useNotifications();
  useAndroidWidgetSync();
  return null;
}

function RootNavigator() {
  useAuthBootstrap();
  // Sign-in links are the main window's job; the widget redeeming the same one would fail it.
  // WIDGET_WINDOW never changes while the window lives, so the hook order is stable.
  if (!WIDGET_WINDOW) useAuthDeepLink(); // eslint-disable-line react-hooks/rules-of-hooks
  useRealtimeSync();
  useAiAccountSync();
  useOpenFromWidget();
  const status = useSessionStore((s) => s.status);
  useAndroidShare(status === "authenticated");
  useFocusAlert(status === "authenticated");
  const prefsHydrated = usePrefs((s) => s.hydrated);
  const c = useThemeColors();

  // One guard for every signed-in page. The tabs redirect when the session ends, but Settings,
  // Account and the note / idea / task / folder pages live outside them and had no guard at all:
  // signing out from Settings left you sitting on Settings. The moment the session is gone, anything
  // that isn't a sign-in page (or the root redirect) goes to the login screen.
  const router = useRouter();
  const segments = useSegments();
  const area = segments[0] as string | undefined;
  useEffect(() => {
    if (status === "unauthenticated") clearAndroidWidget();
    if (status !== "unauthenticated" || WIDGET_WINDOW) return;
    // Shared links (/s/…) are public: no sign-in needed to read one.
    if (area === undefined || area === "(auth)" || area === "auth-callback" || area === "s") return;
    router.replace("/(auth)/login");
  }, [status, area, router]);

  // Wait for persisted prefs before painting content, so the app never flashes the default
  // dark/violet theme before the user's saved theme/accent load.
  if (status === "loading" || !prefsHydrated) {
    return (
      <View className="bg-bg flex-1 items-center justify-center">
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (WIDGET_WINDOW) {
    return status === "authenticated" ? (
      <DesktopWidget />
    ) : (
      <View className="bg-bg flex-1 items-center justify-center px-6">
        <Text className="text-ink-2 text-center text-[13px]">Sign in to Nox in the main window, and your day shows here.</Text>
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
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="account" />
          <Stack.Screen name="task/[id]" />
          <Stack.Screen name="idea/[id]" />
          <Stack.Screen name="note/[id]" />
          <Stack.Screen name="folder/[id]" />
          <Stack.Screen name="space/[id]" />
          <Stack.Screen name="add" options={{ presentation: "modal" }} />
          <Stack.Screen name="inbox" />
          <Stack.Screen name="focus" />
          <Stack.Screen name="review" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="import" />
          <Stack.Screen name="dump" />
          <Stack.Screen name="s/[token]" />
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
