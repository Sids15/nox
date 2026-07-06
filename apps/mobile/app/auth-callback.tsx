import { useAuth, useThemeColors } from "@nox/features";
import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

/**
 * Landing route for auth redirect links (`/auth-callback?code=…`). The root `useAuthDeepLink` hook
 * exchanges the code; this screen just waits, then redirects: a recovery session → the reset screen,
 * a normal session → the app. On a failed exchange the hook replaces this route with login.
 */
export default function AuthCallback() {
  const { isAuthenticated, recovery } = useAuth();
  const c = useThemeColors();

  if (recovery) return <Redirect href="/(auth)/reset-password" />;
  if (isAuthenticated) return <Redirect href="/(tabs)/tasks" />;

  return (
    <View className="bg-bg flex-1 items-center justify-center">
      <ActivityIndicator color={c.accent} />
      <Text className="text-ink-2 mt-4 text-[14px]">Signing you in…</Text>
    </View>
  );
}
