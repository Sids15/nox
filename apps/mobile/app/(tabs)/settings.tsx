import { useAuth } from "@nox/features";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const { session, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 px-6 pt-6">
        <Text className="text-ink mb-2 text-2xl font-semibold">Settings</Text>
        <Text className="text-ink-muted mb-8">
          Signed in as {session?.user?.email ?? "unknown"}
        </Text>

        <Pressable
          onPress={() => {
            void signOut();
          }}
          className="rounded-input items-center border border-border py-3"
        >
          <Text className="text-destructive font-semibold">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
