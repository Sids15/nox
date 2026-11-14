import { useThemeVars } from "@nox/features";
import { vars } from "nativewind";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsDesktop } from "../../lib/use-responsive";
import { TaskComposer } from "./task-composer";

/**
 * Fades the dialog in from 96% scale on a strong ease-out (Emil Kowalski's modal entrance: never from
 * nothing, centred origin because a modal isn't anchored to its trigger). Reduced motion keeps the fade.
 */
function DialogIn({ children }: { children: ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
    Animated.timing(t, { toValue: 1, duration: 200, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [still ? 1 : 0.96, 1] });
  return <Animated.View style={{ width: "100%", alignItems: "center", opacity: t, transform: [{ scale }] }}>{children}</Animated.View>;
}

/**
 * Hosts the new-task composer over the Tasks list, so you never lose your place: a centred dialog on
 * desktop (Linear / Todoist quick add), a bottom sheet riding on the keyboard on phones (Todoist /
 * Apple Reminders). Mounted only while open, so every opening starts from a clean draft.
 */
export function NewTaskDialog({
  visible,
  initialDate,
  initialTime = null,
  onClose,
}: {
  visible: boolean;
  initialDate: string;
  initialTime?: string | null;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const themeVars = useThemeVars();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  if (!visible) return null;

  if (isDesktop) {
    return (
      <Modal transparent visible animationType="fade" onRequestClose={onClose}>
        <View style={vars(themeVars)} className="flex-1 items-center px-6 pt-[10vh]">
          <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} accessibilityLabel="Close" />
          <DialogIn>
          <View
            className="border-line bg-elev w-full max-w-[820px] overflow-hidden rounded-[16px] border"
            style={{ maxHeight: win.height * 0.8, shadowColor: "#1B2131", shadowOpacity: 0.24, shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 20 }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TaskComposer initialDate={initialDate} initialTime={initialTime} onClose={onClose} compact={false} />
            </ScrollView>
          </View>
          </DialogIn>
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
            <TaskComposer initialDate={initialDate} initialTime={initialTime} onClose={onClose} compact />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
