import { useAuth } from "@nox/features";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { Sidebar } from "../../components/sidebar";
import { StatusBar } from "../../components/status-bar";
import { TabBar } from "../../components/tab-bar";
import { useIsDesktop } from "../../lib/use-responsive";

export const unstable_settings = { initialRouteName: "tasks" };

export default function TabsLayout() {
  const { isAuthenticated } = useAuth();
  const isDesktop = useIsDesktop();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  // Ideas · Notes · Tasks · Resources — no Settings tab (avatar/profile opens Settings). Tasks first.
  // Desktop: a left Sidebar with the scene beside it. Mobile: the floating pill tab bar.
  const tabs = (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={isDesktop ? () => null : (props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Ideas" }} />
      <Tabs.Screen name="notes" options={{ title: "Notes" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="resources" options={{ title: "Resources" }} />
    </Tabs>
  );

  if (!isDesktop) return tabs;

  return (
    <View className="bg-bg flex-1 flex-row">
      <Sidebar />
      <View className="flex-1">
        <View className="flex-1">{tabs}</View>
        <StatusBar />
      </View>
    </View>
  );
}
