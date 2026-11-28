// Nox — public, read-only share links.
//
// Anyone with a link's token can read a text-only copy of the one note, idea or space it points at.
// No sign-in: the token is the secret (64 random hex characters made by the database, migration
// 0018). The service key is used only to look up that one share and its target, both scoped to the
// share's owner; view.ts decides exactly which fields leave (no ids, owner, storage paths, tags or
// fields). A removed share stops working at once — responses are never cached.
//
// Deploy:  supabase functions deploy share --no-verify-jwt     (public by design)

import { createClient } from "npm:@supabase/supabase-js@2";
import { isToken, viewIdea, viewNote, viewSpace } from "./view.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

// One answer for "no such link", "removed", and "what it pointed at is gone": nothing to probe.
const NOT_FOUND = () => json(404, { error: "This link doesn't work any more." });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "Method not allowed" });

  let token: unknown = new URL(req.url).searchParams.get("t");
  if (req.method === "POST") {
    const raw = await req.text();
    if (raw.length > 512) return json(400, { error: "Bad request" });
    try {
      token = (JSON.parse(raw) as { token?: unknown }).token;
    } catch {
      return json(400, { error: "Bad request" });
    }
  }
  if (!isToken(token)) return NOT_FOUND();

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "Not configured" });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: share, error } = await db.from("shares").select("user_id, kind, target_id").eq("token", token).eq("deleted", false).maybeSingle();
  if (error) {
    console.error("share lookup failed", error.code);
    return json(500, { error: "Something went wrong" });
  }
  if (!share) return NOT_FOUND();
  const owner = share.user_id as string;
  const id = share.target_id as string;

  if (share.kind === "note" || share.kind === "idea") {
    const table = share.kind === "note" ? "notes" : "ideas";
    const { data: row } = await db.from(table).select("*").eq("id", id).eq("user_id", owner).eq("deleted", false).maybeSingle();
    if (!row) return NOT_FOUND();
    return json(200, share.kind === "note" ? viewNote(row) : viewIdea(row));
  }

  if (share.kind === "space") {
    const { data: space } = await db.from("spaces").select("*").eq("id", id).eq("user_id", owner).eq("deleted", false).maybeSingle();
    if (!space) return NOT_FOUND();
    const scoped = (table: string, cols: string) => db.from(table).select(cols).eq("space_id", id).eq("user_id", owner).eq("deleted", false).limit(500);
    const [tasks, notes, ideas] = await Promise.all([
      scoped("tasks", "title, status, due_date, repeat, origin_task_id, deleted"),
      scoped("notes", "title, content, is_archived, deleted"),
      scoped("ideas", "title, status, is_archived, deleted"),
    ]);
    return json(200, viewSpace(space, (tasks.data ?? []) as Record<string, unknown>[], (notes.data ?? []) as Record<string, unknown>[], (ideas.data ?? []) as Record<string, unknown>[]));
  }

  return NOT_FOUND();
});
