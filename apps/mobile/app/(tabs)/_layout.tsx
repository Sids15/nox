import { useAuth } from "@nox/features";
import { dark } from "@nox/ui";
import { Redirect, Tabs } from "expo-router";

export const unstable_settings = { initialRouteName: "tasks" };

export default function TabsLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: dark.surface,
          borderTopColor: dark.line,
        },
        tabBarActiveTintColor: dark.accent,
        tabBarInactiveTintColor: dark.ink3,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Ideas" }} />
      <Tabs.Screen name="notes" options={{ title: "Notes" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
