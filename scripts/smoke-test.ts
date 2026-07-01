/**
 * Nox backend smoke test (dev tool). Verifies the Supabase wiring the app depends on:
 * auth sign-up + session, the handle_new_user trigger, owner RLS on inserts/reads, and
 * cross-user RLS isolation. Uses the SAME URL + anon key as the app (apps/mobile/.env).
 *
 * Run:  bun run scripts/smoke-test.ts
 * Note: creates two throwaway auth users (email confirm must be OFF); the anon key can't
 *       delete auth users, so they linger in Supabase Auth — remove them there if you wish.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1]) out[m[1]] = m[2] ?? "";
    }
  } catch {
    /* handled below */
  }
  return out;
}

const env = loadEnv(join(here, "..", "apps", "mobile", ".env"));
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env");
  process.exit(2);
}
console.log(`Target: ${url}\n`);

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  // `detail` is the failure reason — only show it when the check fails.
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
};

const mkClient = () =>
  createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const ts = Date.now();
const userA = { email: `smoke-a-${ts}@noxtest.dev`, password: "smoke-test-pw-123" };
const userB = { email: `smoke-b-${ts}@noxtest.dev`, password: "smoke-test-pw-123" };

const a = mkClient();
const b = mkClient();

// 1. Auth: sign up A and get an immediate session (only if "Confirm email" is OFF).
const { data: aUp, error: aErr } = await a.auth.signUp(userA);
check(
  "auth: sign up returns a session (email confirm off + email auth enabled)",
  !aErr && !!aUp?.session,
  aErr?.message ?? (aUp?.session ? "" : "no session — is 'Confirm email' still ON, or email auth disabled?"),
);
const aId = aUp?.user?.id;
if (!aUp?.session || !aId) {
  console.log("\nCannot continue without a session — fix the auth error above.");
  process.exit(1);
}

// 2. DB: the handle_new_user trigger provisioned a public.users row (confirms migration 0001).
const { data: userRow, error: userErr } = await a.from("users").select("id,email").eq("id", aId).maybeSingle();
check("db: handle_new_user created public.users row", !userErr && userRow?.id === aId, userErr?.message ?? "row not found");

// 3. DB: owner can insert (RLS WITH CHECK) and read back a task.
const { data: task, error: insErr } = await a
  .from("tasks")
  .insert({ user_id: aId, title: "smoke test task" })
  .select()
  .single();
check("db: insert + read back own task (owner RLS)", !insErr && !!task?.id, insErr?.message ?? "");

// 4. RLS: a second user must NOT be able to read the first user's task.
const { data: bUp, error: bErr } = await b.auth.signUp(userB);
check("auth: second user sign up", !bErr && !!bUp?.session, bErr?.message ?? "");
if (task?.id && bUp?.session) {
  const { data: leak, error: leakErr } = await b.from("tasks").select("id").eq("id", task.id);
  check("rls: user B cannot read user A's task", !leakErr && (leak?.length ?? 0) === 0, leakErr?.message ?? `saw ${leak?.length ?? 0} row(s)`);
}

// 5. Cleanup the row we created (owner delete).
if (task?.id) {
  const { error: delErr } = await a.from("tasks").delete().eq("id", task.id);
  check("db: owner can delete own task", !delErr, delErr?.message ?? "");
}

await a.auth.signOut();
await b.auth.signOut();

console.log(`\n${failures === 0 ? "✅ SMOKE TEST PASSED" : `❌ ${failures} CHECK(S) FAILED`}`);
console.log(`(test users left in Auth: ${userA.email}, ${userB.email})`);
process.exit(failures === 0 ? 0 : 1);
