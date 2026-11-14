import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NoteEditor } from "../../components/notes/note-editor";
import { Sidebar } from "../../components/sidebar";
import { useIsDesktop } from "../../lib/use-responsive";
import { goBack } from "../../lib/go-back";

/**
 * Standalone note route — used on mobile (always) and for desktop deep-links. The desktop Notes 3-pane
 * renders <NoteEditor> in its editor pane instead of navigating here. Keeps the sidebar frame on
 * desktop so a deep-linked editor still sits inside the app chrome.
 */
export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDesktop = useIsDesktop();

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <View className="flex-1 flex-row">
        {isDesktop && <Sidebar />}
        <View className="flex-1">
          <NoteEditor id={id} onClose={() => goBack("/notes")} />
        </View>
      </View>
    </SafeAreaView>
  );
}
