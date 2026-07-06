import { useAuth, useThemeColors } from "@nox/features";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

/**
 * Detects an auth error handed back in the redirect URL (Supabase puts it in the fragment, e.g.
 * `#error=access_denied&error_code=otp_expired&error_description=…`). Web only — native error paths
 * are covered by the deep-link handler falling back to login.
 *
 * We map the machine-readable `error_code` to our own fixed copy and NEVER render the URL's
 * `error_description`: it is attacker-controllable, so reflecting it verbatim on this trusted page
 * would let a crafted link show arbitrary phishing text ("call this number to unlock…").
 */
function readAuthError(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "") || window.location.search.replace(/^\?/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (!params.get("error") && !params.get("error_code")) return null;
  switch (params.get("error_code")) {
    case "otp_expired":
      return "This link has expired or was already used.";
    case "access_denied":
      return "This link is no longer valid.";
    default:
      return "This link is invalid or has expired.";
  }
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
