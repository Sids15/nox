// Nox — permanent account deletion.
//
// This is the one operation the app cannot perform with the anon key: removing a user from
// auth.users requires the service_role key, which must never ship in a client bundle. So it lives
// here, where the key is injected by the platform and never leaves the server.
//
// The account deleted is ALWAYS the one that owns the caller's JWT. No id is read from the request
// body — that is the whole security boundary of this function, and it must stay that way. A body
// parameter would turn a valid session for any account into a delete primitive for every account.
//
// Deploy:  supabase functions deploy delete-account
// (verify_jwt is on by default, so unauthenticated calls are rejected before this code runs; the
// explicit getUser() below is what tells us *which* user, and re-checks the token independently.)

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Every private bucket that stores user media under a `{user_id}/…` prefix (0003, 0006). */
const BUCKETS = ["audio", "images", "sketches"] as const;

const PAGE = 1000;
/** `{user_id}/{parent_id}/{file}` is 2 levels; the cap is slack, not the expected shape. */
const MAX_DEPTH = 4;

// Safe as `*`: authorization is a bearer token the caller must attach deliberately, there are no
// cookies, and the response carries no credentials — so a hostile page cannot make this call on a
// signed-in user's behalf the way it could with cookie auth.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/**
 * Every object path under `prefix`, walking into folders. Supabase returns a folder as a row with a
 * null `id`, which is the only way to tell it apart from a file. Paginated because a truncated
 * listing here would silently leave a deleted user's private media on disk.
 */
async function listAll(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];

  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) paths.push(...(await listAll(admin, bucket, path, depth + 1)));
      else paths.push(path);
    }
    if (data.length < PAGE) break;
  }
  return paths;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    console.error("delete-account: missing platform env");
    return json(500, { error: "server misconfigured" });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "missing bearer token" });

  // Resolve the caller with the ANON key + their own token, so RLS and token validation apply
  // exactly as they would in the app. This — not the request body — decides whose account dies.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return json(401, { error: "invalid session" });

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Storage BEFORE the user row, deliberately. Deleting the auth user cascades every table
  // (public.users → tasks/ideas/notes/folders/resources/tags, 0001) but Storage objects are not
  // foreign-keyed to it, so a user-first order that then failed would leave private files with no
  // owner and no way to find them again. Failing here instead leaves the account fully intact and
  // the request safely retryable, and preserves the invariant that matters: if the account is
  // gone, the files are gone.
  try {
    for (const bucket of BUCKETS) {
      const paths = await listAll(admin, bucket, user.id);
      // remove([]) is a no-op error in some versions — skip empty explicitly.
      if (paths.length === 0) continue;
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw new Error(`remove ${bucket}: ${error.message}`);
    }
  } catch (e) {
    console.error("delete-account: storage cleanup failed", e);
    return json(500, { error: "could not remove stored files; account not deleted" });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("delete-account: user delete failed", deleteError);
    return json(500, { error: "could not delete the account" });
  }

  return json(200, { deleted: true });
});
