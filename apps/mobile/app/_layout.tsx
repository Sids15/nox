import "react-native-url-polyfill/auto";
import "../global.css";

import { queryClient, queryPersister } from "@nox/db";
import { useAuthBootstrap, useSessionStore } from "@nox/features";
import { lamplight } from "@nox/ui";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initSentry } from "../lib/sentry";

initSentry();

function RootNavigator() {
  useAuthBootstrap();
  const status = useSessionStore((s) => s.status);

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={lamplight.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: lamplight.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister }}
    >
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
