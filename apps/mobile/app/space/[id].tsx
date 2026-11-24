import { useSpaces, useThemeColors } from "@nox/features";
import { useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SpaceView } from "../../components/brain/space-view";
import { Sidebar } from "../../components/sidebar";
import { goBack } from "../../lib/go-back";
import { useIsDesktop } from "../../lib/use-responsive";

/** A space's page. Keeps the sidebar frame on desktop, like the editor routes. */
export default function SpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDesktop = useIsDesktop();
  const c = useThemeColors();
  const { data: spaces = [], isLoading } = useSpaces();
  const space = spaces.find((s) => s.id === id);

  return (
    <SafeAreaView className="bg-bg flex-1" edges={["top"]}>
      <View className="flex-1 flex-row">
        {isDesktop && <Sidebar />}
        <View className="flex-1">
          {space ? (
            <SpaceView key={space.id} space={space} />
          ) : (
            <View className="px-screen pt-2">
              <Pressable onPress={() => goBack("/spaces")} hitSlop={8} className="bg-chip rounded-pill h-[34px] w-[34px] items-center justify-center">
                <ChevronLeft size={20} color={c.ink2} strokeWidth={2.2} />
              </Pressable>
              <Text className="text-ink-2 mt-8 text-[15px]">{isLoading ? "Loading…" : "Space not found."}</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
