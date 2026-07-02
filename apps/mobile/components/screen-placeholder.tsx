import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileAvatar } from "./profile-avatar";

/** Neutral placeholder used until each module's branded UI lands. Carries the standard header
 *  (title + profile avatar) so Settings stays reachable from every tab. */
export function ScreenPlaceholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="px-screen flex-row items-center justify-between pt-2">
        <Text className="text-ink text-3xl font-bold">{title}</Text>
        <ProfileAvatar />
      </View>
      <View className="px-screen flex-1 items-center justify-center">
        {subtitle ? (
          <Text className="text-ink-2 text-center text-base">{subtitle}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
