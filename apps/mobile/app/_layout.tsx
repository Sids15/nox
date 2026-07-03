import "react-native-gesture-handler";
import "react-native-url-polyfill/auto";
import "../global.css";

import { queryClient, queryPersister } from "@nox/db";
import { useAuthBootstrap, useSessionStore } from "@nox/features";
import { dark } from "@nox/ui";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initSentry } from "../lib/sentry";

// Dark-first: force dark regardless of the device appearance. Expo Go ignores app.json's
// userInterfaceStyle, so without this a light-mode phone would render the app light. The real
// light/dark toggle lands with the Settings slice.
colorScheme.set("dark");
initSentry();

function RootNavigator() {
  useAuthBootstrap();
  const status = useSessionStore((s) => s.status);

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={dark.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: dark.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="task/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister }}
      >
        <SafeAreaProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
