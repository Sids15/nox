import { createClient } from "@supabase/supabase-js";
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
