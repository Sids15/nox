import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sidebar } from "../../components/sidebar";
import { TaskEditor } from "../../components/tasks/task-editor";
import { useIsDesktop } from "../../lib/use-responsive";

/**
 * Standalone task route — used on mobile (always) and for desktop deep-links. The desktop master-detail
 * Tasks screen renders <TaskEditor> in a pane instead of navigating here. Keeps the sidebar frame on
 * desktop so a deep-linked editor still sits inside the app chrome.
 */
export default function TaskDetailScreen() {
  const { id, new: newParam } = useLocalSearchParams<{ id: string; new?: string }>();
  const router = useRouter();
  const isDesktop = useIsDesktop();

  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="flex-1 flex-row">
        {isDesktop && <Sidebar />}
        <View className="flex-1">
          <TaskEditor id={id} isNew={newParam === "1"} onClose={() => router.back()} />
        </View>
      </View>
    </SafeAreaView>
  );
}
