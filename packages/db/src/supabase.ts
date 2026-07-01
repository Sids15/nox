import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { env } from "./env";
import { secureStoreAdapter } from "./secure-store-adapter";

/**
 * The single Supabase client for the app. Holds ONLY the anon key (service_role must never
 * ship to the client). Sessions persist in the encrypted keystore and auto-refresh; PKCE flow
 * is used for magic-link / OAuth security. `react-native-url-polyfill/auto` must be imported
 * once at the app entry before this module is used.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

// React Native suspends timers in the background, so the token refresh ticker must be tied to
// app focus: refresh while foregrounded, pause when backgrounded. Without this, the access
// token can silently expire and authed requests fail on resume.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
