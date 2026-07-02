import { dark } from "@nox/ui";
import { useAuth } from "@nox/features";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Settings — pushed from the profile avatar (no tab bar). Minimal for now: identity + sign-out.
 * The full handoff screen (theme toggle, accent picker, notifications, sync, device list) lands
 * with the theming slice.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView className="bg-bg flex-1">
      <View className="px-screen flex-1 pt-2">
        <View className="mb-8 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="bg-chip rounded-pill -ml-1 h-9 w-9 items-center justify-center"
          >
            <ChevronLeft size={22} color={dark.ink} strokeWidth={1.7} />
          </Pressable>
          <Text className="text-ink ml-2 text-2xl font-bold">Settings</Text>
        </View>

        <Text className="text-ink-2 mb-8">
          Signed in as {session?.user?.email ?? "unknown"}
        </Text>

        <Pressable
          disabled={signingOut}
          onPress={handleSignOut}
          className="rounded-input border-line items-center border py-3"
        >
          <Text className="text-high font-semibold">Sign out</Text>
        </Pressable>
        {error ? <Text className="text-high mt-3">{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}
