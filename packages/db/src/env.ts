import { z } from "zod";

/**
 * Validated runtime configuration. Only `EXPO_PUBLIC_*` values are inlined into the client
 * bundle — these are safe to be public (Supabase URL + anon key are protected by RLS; the
 * Sentry DSN is a client credential). The Supabase service_role key is NEVER read here.
 */
const schema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
  sentryDsn: z.string().url().optional(),
});

function readEnv() {
  const parsed = schema.safeParse({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
  });

  if (!parsed.success) {
    // Fail fast and loud — never boot with invalid config (see rules.md).
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`[nox] Invalid environment configuration:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

export const env = readEnv();
export type Env = typeof env;
