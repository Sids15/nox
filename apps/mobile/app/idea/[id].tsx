import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IdeaEditor } from "../../components/ideas/idea-editor";
import { Sidebar } from "../../components/sidebar";
import { useIsDesktop } from "../../lib/use-responsive";
import { goBack } from "../../lib/go-back";

/**
 * Standalone idea route — used on mobile (always) and for desktop deep-links. The desktop master-detail
 * Ideas screen renders <IdeaEditor> in a pane instead of navigating here. Keeps the sidebar frame on
 * desktop so a deep-linked editor still sits inside the app chrome.
 */
export default function IdeaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDesktop = useIsDesktop();

  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="flex-1 flex-row">
        {isDesktop && <Sidebar />}
        <View className="flex-1">
          <IdeaEditor id={id} onClose={() => goBack("/")} />
        </View>
      </View>
    </SafeAreaView>
  );
}
