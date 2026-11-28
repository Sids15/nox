// Nox — two-way Google Calendar.
//
//   POST {action:"start", returnTo}   (signed in) → a Google consent URL (PKCE, one-time state)
//   GET  /gcal/callback?code&state    (from Google) → stores the sealed refresh token, back to Nox
//   POST {action:"sync", from, to}    (signed in) → pushes/pulls task ↔ event changes (map.ts) and
//                                       returns the other events in [from, to] for the calendar
//   POST {action:"disconnect"}        (signed in) → revokes at Google, forgets the account
//
// Scope: calendar.events only. Refresh tokens are sealed with GCAL_TOKEN_KEY (AES-GCM) and never
// leave the server; events are passed through to the app, never stored. Callers are checked against
// Supabase Auth here (the callback can't carry a session, so verify_jwt is off for this function).
//
// Secrets:  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GCAL_TOKEN_KEY (32 random bytes, base64),
//           GCAL_RETURN_URLS (comma-separated allowed places to return to, e.g. "https://nox.app,nox://")
// Google:   authorised redirect URI = https://<ref>.supabase.co/functions/v1/gcal/callback
// Deploy:   supabase functions deploy gcal --no-verify-jwt

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { importKey, open, pkce, safeReturn, seal } from "./crypto.ts";
import { eventForApp, syncPlan, taskToEvent, type GEvent, type Link, type TaskRow } from "./map.ts";

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const STATE_TTL_MS = 15 * 60_000;
const MAX_STEPS = 100;
const MAX_LOOKUPS = 50;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const env = (k: string) => Deno.env.get(k) ?? "";
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const redirectUri = () => `${env("SUPABASE_URL")}/functions/v1/gcal/callback`;
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

async function tokenRequest(params: Record<string, string>): Promise<{ access_token?: string; refresh_token?: string; error?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...params }),
  });
  return await res.json();
}

async function google(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  if (!env("GOOGLE_CLIENT_ID") || !env("GOOGLE_CLIENT_SECRET") || !env("GCAL_TOKEN_KEY")) return json(501, { error: "Google Calendar isn't set up on this server." });
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const key = await importKey(env("GCAL_TOKEN_KEY"));
  const allowed = env("GCAL_RETURN_URLS").split(",").map((s) => s.trim()).filter(Boolean);

  // ── Google's redirect back ──────────────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname.endsWith("/callback")) {
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    const back = (to: string, result: string) => Response.redirect(`${to}${to.includes("?") ? "&" : "?"}gcal=${result}`, 302);
    if (!/^[0-9a-f]{64}$/.test(state)) return json(400, { error: "Bad request" });
    const { data: row } = await admin.from("gcal_states").delete().eq("state", state).select("user_id, verifier, return_to, created_at").maybeSingle();
    if (!row) return json(400, { error: "This sign-in link has expired. Start again from Nox." });
    const to = safeReturn(row.return_to, allowed, allowed[0] ?? "nox://settings");
    if (Date.now() - new Date(row.created_at).getTime() > STATE_TTL_MS || !code) return back(to, "error");

    const tokens = await tokenRequest({ code, code_verifier: row.verifier, grant_type: "authorization_code", redirect_uri: redirectUri() });
    if (!tokens.access_token || !tokens.refresh_token) return back(to, "error");
    // The calendar's owner and zone come back with an events list (no extra scope needed).
    const probe = await google(tokens.access_token, "?maxResults=1");
    const info = probe.ok ? ((await probe.json()) as { summary?: string; timeZone?: string }) : {};
    const { error } = await admin.from("gcal_accounts").upsert({
      user_id: row.user_id,
      google_email: (info.summary ?? "").slice(0, 320) || null,
      refresh_token_enc: await seal(key, tokens.refresh_token),
      time_zone: (info.timeZone ?? "UTC").slice(0, 64),
    });
    return back(to, error ? "error" : "connected");
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // ── Signed-in actions ───────────────────────────────────────────────────────────────────────────
  const caller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json(401, { error: "Sign in first" });
  let body: { action?: string; returnTo?: unknown; from?: unknown; to?: unknown };
  try {
    body = JSON.parse((await req.text()).slice(0, 2000));
  } catch {
    return json(400, { error: "Bad request" });
  }

  if (body.action === "start") {
    const { verifier, challenge } = await pkce();
    const state = hex(32);
    await admin.from("gcal_states").delete().lt("created_at", new Date(Date.now() - STATE_TTL_MS).toISOString());
    const { error } = await admin.from("gcal_states").insert({ state, user_id: user.id, verifier, return_to: safeReturn(body.returnTo, allowed, allowed[0] ?? "nox://settings") });
    if (error) return json(500, { error: "Couldn't start" });
    const q = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return json(200, { url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
  }

  const { data: account } = await admin.from("gcal_accounts").select("refresh_token_enc, time_zone, push_tasks, google_email").eq("user_id", user.id).maybeSingle();

  if (body.action === "disconnect") {
    if (account) {
      try {
        const refresh = await open(key, account.refresh_token_enc);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: "POST" });
      } catch {
        /* already gone */
      }
    }
    await admin.from("gcal_links").delete().eq("user_id", user.id);
    await admin.from("gcal_accounts").delete().eq("user_id", user.id);
    return json(200, { connected: false });
  }

  if (body.action === "sync") {
    if (!account) return json(200, { connected: false, events: [] });
    const today = new Date().toISOString().slice(0, 10);
    const from = isDay(body.from) ? body.from : addDays(today, -1);
    let to = isDay(body.to) ? body.to : addDays(today, 14);
    if (to < from) to = from;
    if (to > addDays(from, 62)) to = addDays(from, 62);

    let access: string | undefined;
    try {
      const t = await tokenRequest({ refresh_token: await open(key, account.refresh_token_enc), grant_type: "refresh_token" });
      access = t.access_token;
      if (t.error === "invalid_grant") {
        // Access was removed in Google: forget the connection.
        await admin.from("gcal_links").delete().eq("user_id", user.id);
        await admin.from("gcal_accounts").delete().eq("user_id", user.id);
        return json(200, { connected: false, events: [] });
      }
    } catch {
      /* falls through */
    }
    if (!access) return json(502, { error: "Couldn't reach Google. Try again in a minute." });

    const synced = await syncTasks(admin, user.id, access, account.time_zone, account.push_tasks, today);
    const list = await google(access, `?${new URLSearchParams({ timeMin: `${addDays(from, -1)}T00:00:00Z`, timeMax: `${addDays(to, 1)}T23:59:59Z`, singleEvents: "true", orderBy: "startTime", maxResults: "250" })}`);
    const items = list.ok ? (((await list.json()) as { items?: GEvent[] }).items ?? []) : [];
    await admin.from("gcal_accounts").update({ last_synced_at: new Date().toISOString() }).eq("user_id", user.id);
    return json(200, { connected: true, email: account.google_email, events: items.map(eventForApp).filter(Boolean), changed: synced });
  }

  return json(400, { error: "Unknown action" });
});

/** Bring tasks and their events into step (both ways). Returns how many changes were made. */
async function syncTasks(db: SupabaseClient, userId: string, access: string, tz: string, pushTasks: boolean, today: string): Promise<number> {
  const cols = "id, title, due_date, due_time, duration_minutes, status, deleted, repeat, origin_task_id, updated_at";
  const { data: linkRows } = await db.from("gcal_links").select("task_id, event_id, synced_at").eq("user_id", userId);
  const links = (linkRows ?? []) as Link[];
  const { data: windowTasks } = await db.from("tasks").select(cols).eq("user_id", userId).eq("deleted", false).gte("due_date", addDays(today, -7)).lte("due_date", addDays(today, 60)).not("due_time", "is", null).limit(1000);
  const linkedIds = links.map((l) => l.task_id);
  const { data: linkedTasks } = linkedIds.length ? await db.from("tasks").select(cols).eq("user_id", userId).in("id", linkedIds.slice(0, 1000)) : { data: [] };
  const tasks = new Map<string, TaskRow>();
  for (const t of [...((windowTasks ?? []) as TaskRow[]), ...((linkedTasks ?? []) as TaskRow[])]) tasks.set(t.id, t);

  // The linked events as Google has them now (null: deleted there).
  const events = new Map<string, GEvent | null>();
  for (const l of links.slice(0, MAX_LOOKUPS)) {
    const res = await google(access, `/${encodeURIComponent(l.event_id)}`);
    if (res.status === 404 || res.status === 410) events.set(l.event_id, null);
    else if (res.ok) events.set(l.event_id, (await res.json()) as GEvent);
  }

  const steps = syncPlan([...tasks.values()], links, events, tz, pushTasks).slice(0, MAX_STEPS);
  const stamp = (updated?: string) => {
    const now = new Date().toISOString();
    return updated && updated > now ? updated : now;
  };
  let changed = 0;
  for (const s of steps) {
    try {
      if (s.op === "create-event") {
        const res = await google(access, "", { method: "POST", body: JSON.stringify(taskToEvent(s.task, tz)) });
        if (!res.ok) continue;
        const e = (await res.json()) as GEvent;
        await db.from("gcal_links").upsert({ task_id: s.task.id, user_id: userId, event_id: e.id, synced_at: stamp(e.updated) });
      } else if (s.op === "update-event") {
        const res = await google(access, `/${encodeURIComponent(s.eventId)}`, { method: "PATCH", body: JSON.stringify(taskToEvent(s.task, tz)) });
        if (!res.ok) continue;
        const e = (await res.json()) as GEvent;
        await db.from("gcal_links").update({ synced_at: stamp(e.updated) }).eq("task_id", s.task.id);
      } else if (s.op === "delete-event") {
        const res = await google(access, `/${encodeURIComponent(s.eventId)}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404 && res.status !== 410) continue;
        await db.from("gcal_links").delete().eq("task_id", s.taskId);
      } else if (s.op === "update-task") {
        const { error } = await db.from("tasks").update(s.patch).eq("id", s.task.id).eq("user_id", userId);
        if (error) continue;
        await db.from("gcal_links").update({ synced_at: stamp() }).eq("task_id", s.task.id);
      } else if (s.op === "untime-task") {
        await db.from("tasks").update({ due_time: null }).eq("id", s.taskId).eq("user_id", userId);
        await db.from("gcal_links").delete().eq("task_id", s.taskId);
      } else {
        await db.from("gcal_links").delete().eq("task_id", s.taskId);
      }
      changed++;
    } catch {
      /* one failed step doesn't stop the rest; it's retried next sync */
    }
  }
  return changed;
}
