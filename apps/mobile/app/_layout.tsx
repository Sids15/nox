import "react-native-gesture-handler";
import "react-native-url-polyfill/auto";
import "../global.css";

import { queryClient, queryPersister } from "@nox/db";
import {
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

initSentry();

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

function RootNavigator() {
  useAuthBootstrap();
  useRealtimeSync();
  const status = useSessionStore((s) => s.status);
  const c = useThemeColors();

  if (status === "loading") {
    return (
      <View className="bg-bg flex-1 items-center justify-center">
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="task/[id]" />
      <Stack.Screen name="idea/[id]" />
      <Stack.Screen name="note/[id]" />
      <Stack.Screen name="folder/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: queryPersister }}
        >
          <SafeAreaProvider>
            <RootNavigator />
          </SafeAreaProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
