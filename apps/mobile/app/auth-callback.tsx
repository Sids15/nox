import { useAuth, useThemeColors } from "@nox/features";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { authErrorCopy, initialAuthErrorCode } from "../lib/auth-url-error";

/**
 * Landing route for auth redirect links (`/auth-callback`). On success the root `useAuthDeepLink`
 * hook (native) or supabase-js `detectSessionInUrl` (web) sets the session; this screen waits, then
 * redirects — a recovery session → the reset screen, a normal session → the app. If the link itself
 * was invalid or expired, Supabase returns an error instead of a session, so we surface it here with
 * a way back to sign in rather than spinning forever.
 */
export default function AuthCallback() {
  const { isAuthenticated, recovery } = useAuth();
  const c = useThemeColors();
  // Two arrival paths. Native (and the Tauri shell) get here via the deep-link handler, which
  // forwards the code as a route param; a plain browser tab lands on the URL Supabase redirected
  // to, whose fragment was captured at module load before supabase-js could strip it.
  const { error_code } = useLocalSearchParams<{ error_code?: string }>();
  const authError = authErrorCopy(error_code ?? initialAuthErrorCode);

  // Errors are checked FIRST. `recovery` is sticky session state from an earlier link, so a stale
  // flag would otherwise send a user whose link just failed to the new-password screen, where they
  // would type a password that cannot possibly save.
  if (!authError && recovery) return <Redirect href="/(auth)/reset-password" />;
  if (!authError && isAuthenticated) return <Redirect href="/(tabs)/tasks" />;

  if (authError) {
    return (
      <View className="bg-bg flex-1 items-center justify-center px-8">
        <Text className="text-ink text-center text-[17px] font-bold">This link didn't work</Text>
        <Text className="text-ink-2 mt-2 text-center text-[14px] leading-[21px]">
          {authError} Email links are single-use and time-limited — request a new one and open the
          most recent email.
        </Text>
        <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8} className="mt-6">
          <Text className="text-[15px] font-semibold" style={{ color: c.accent }}>
            Back to sign in
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="bg-bg flex-1 items-center justify-center">
      <ActivityIndicator color={c.accent} />
      <Text className="text-ink-2 mt-4 text-[14px]">Signing you in…</Text>
    </View>
  );
}
