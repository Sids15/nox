import { useAuth } from "@nox/features";
import { Redirect, Tabs } from "expo-router";
import { TabBar } from "../../components/tab-bar";

export const unstable_settings = { initialRouteName: "tasks" };

export default function TabsLayout() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  // Ideas · Notes · Tasks · Resources — no Settings tab (avatar opens Settings). Tasks lands first.
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Ideas" }} />
      <Tabs.Screen name="notes" options={{ title: "Notes" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="resources" options={{ title: "Resources" }} />
    </Tabs>
  );
}
