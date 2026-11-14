import { useThemeVars } from "@nox/features";
import { vars } from "nativewind";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsDesktop } from "../../lib/use-responsive";
import { TaskComposer } from "./task-composer";

/**
 * Hosts the new-task composer over the Tasks list, so you never lose your place: a centred dialog on
 * desktop (Linear / Todoist quick add), a bottom sheet riding on the keyboard on phones (Todoist /
 * Apple Reminders). Mounted only while open, so every opening starts from a clean draft.
 */
export function NewTaskDialog({
  visible,
  initialDate,
  onClose,
}: {
  visible: boolean;
  initialDate: string;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const themeVars = useThemeVars();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  if (isDesktop) {
    return (
      <Modal transparent visible animationType="fade" onRequestClose={onClose}>
        <View style={vars(themeVars)} className="flex-1 items-center px-6 pt-[12vh]">
          <Pressable className="absolute inset-0 bg-black/55" onPress={onClose} accessibilityLabel="Close" />
          <View
            className="border-line bg-elev w-full max-w-[620px] overflow-hidden rounded-[16px] border"
            style={{ maxHeight: "80%", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 60, shadowOffset: { width: 0, height: 24 }, elevation: 20 }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TaskComposer initialDate={initialDate} onClose={onClose} compact={false} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[{ flex: 1, justifyContent: "flex-end" }, vars(themeVars)]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable className="absolute inset-0 bg-black/55" onPress={onClose} accessibilityLabel="Close" />
        <View
          className="bg-sheet rounded-t-[22px]"
          style={{ maxHeight: "88%", paddingBottom: Math.max(insets.bottom, 8), shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: -10 }, elevation: 16 }}
        >
          <View className="bg-ink-3 mt-2 h-1 w-9 self-center rounded-full opacity-50" />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TaskComposer initialDate={initialDate} onClose={onClose} compact />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
