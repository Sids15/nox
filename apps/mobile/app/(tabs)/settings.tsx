import { useAuth } from "@nox/features";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
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
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 px-6 pt-6">
        <Text className="text-ink mb-2 text-2xl font-semibold">Settings</Text>
        <Text className="text-ink-muted mb-8">
          Signed in as {session?.user?.email ?? "unknown"}
        </Text>

        <Pressable
          disabled={signingOut}
          onPress={handleSignOut}
          className="rounded-input items-center border border-border py-3"
        >
          <Text className="text-destructive font-semibold">Sign out</Text>
        </Pressable>
        {error ? <Text className="text-destructive mt-3">{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}
