import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Neutral placeholder used until each module's branded UI lands (Phase 1+). */
export function ScreenPlaceholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-ink text-2xl font-semibold">{title}</Text>
        {subtitle ? (
          <Text className="text-ink-muted mt-2 text-center text-base">{subtitle}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
