import { useAuth, useThemeColors } from "@nox/features";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

/**
 * Reads an auth error handed back in the redirect URL (Supabase puts it in the fragment, e.g.
 * `#error=access_denied&error_code=otp_expired&error_description=…`). Web only — native error paths
 * are covered by the deep-link handler falling back to login.
 */
function readAuthError(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "") || window.location.search.replace(/^\?/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  return params.get("error_description") ?? params.get("error");
}

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
  // Captured on first render, before supabase-js can strip the fragment.
  const [authError] = useState(readAuthError);

  if (recovery) return <Redirect href="/(auth)/reset-password" />;
  if (isAuthenticated) return <Redirect href="/(tabs)/tasks" />;

  if (authError) {
    return (
      <View className="bg-bg flex-1 items-center justify-center px-8">
        <Text className="text-ink text-center text-[18px] font-bold">This link didn't work</Text>
        <Text className="text-ink-2 mt-2 text-center text-[14px] leading-[21px]">
          {authError}. Email links are single-use and time-limited — request a new one and open the
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
