// Nox — server reminders (push). Run every hour by a schedule (see supabase/push_schedule.sql.example).
//
// For each person with a registered device, works out their local hour (plan.ts). Only when one of
// their reminders is due this hour does it count their open tasks / overdue tasks / near deadlines,
// record the send in push_log (so a re-run never sends twice), and push to their devices:
//   • phones: Expo's push service (ExponentPushToken[…])
//   • browsers: Web Push with this project's VAPID keys
// Payloads hold counts and a path to open — never titles or names. Dead devices are removed.
//
// Secrets:  PUSH_CRON_SECRET (required; the schedule sends it), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//           VAPID_SUBJECT (e.g. mailto:you@example.com), EXPO_ACCESS_TOKEN (optional).
// Deploy:   supabase functions deploy push --no-verify-jwt     (it checks PUSH_CRON_SECRET itself)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { dueKinds, localClock, messages, readPrefs, type Message } from "./plan.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Constant-time string compare, so the secret can't be guessed a character at a time. */
function same(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

interface Device {
  id: string;
  user_id: string;
  kind: "expo" | "web";
  token: string;
  keys: { p256dh?: string; auth?: string } | null;
  tz: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const secret = Deno.env.get("PUSH_CRON_SECRET") ?? "";
  if (!secret || !same(req.headers.get("x-push-secret") ?? "", secret)) return json(401, { error: "Unauthorized" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "Not configured" });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const webReady = !!(vapidPublic && vapidPrivate);
  if (webReady) webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@example.com", vapidPublic!, vapidPrivate!);

  const { data: devices, error } = await db.from("push_devices").select("id, user_id, kind, token, keys, tz").limit(10_000);
  if (error) return json(500, { error: "Couldn't read devices" });

  const byUser = new Map<string, Device[]>();
  for (const d of (devices ?? []) as Device[]) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);

  const now = new Date();
  let sent = 0;
  let removed = 0;

  for (const [userId, list] of byUser) {
    const { data: user } = await db.from("users").select("push_prefs").eq("id", userId).maybeSingle();
    const prefs = readPrefs(user?.push_prefs);
    // The person's clock: their most recently registered device's zone.
    const clock = localClock(now, list[list.length - 1]!.tz);
    const kinds = dueKinds(prefs, clock.hour);
    if (kinds.length === 0) continue;

    const tasks = () => db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("deleted", false).eq("status", "pending").or("repeat.eq.none,origin_task_id.not.is.null");
    const [today, overdue, deadlines] = await Promise.all([
      tasks().eq("due_date", clock.day),
      tasks().lt("due_date", clock.day),
      db.from("spaces").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("deleted", false).eq("archived", false).gte("due_date", clock.day).lte("due_date", addDays(clock.day, 2)),
    ]);
    const msgs = messages(kinds, { today: today.count ?? 0, overdue: overdue.count ?? 0, deadlines: deadlines.count ?? 0 });
    if (msgs.length === 0) continue;

    // Claim each message for this local day first: a second run this hour gets nothing back.
    const { data: claimed } = await db
      .from("push_log")
      .upsert(msgs.map((m) => ({ user_id: userId, kind: m.kind, day: clock.day })), { onConflict: "user_id,kind,day", ignoreDuplicates: true })
      .select("kind");
    const fresh = msgs.filter((m) => (claimed ?? []).some((c: { kind: string }) => c.kind === m.kind));
    if (fresh.length === 0) continue;

    for (const d of list) {
      const dead = d.kind === "expo" ? await sendExpo(d, fresh) : webReady ? await sendWeb(d, fresh) : false;
      if (dead) {
        await db.from("push_devices").delete().eq("id", d.id);
        removed++;
      } else sent += fresh.length;
    }
  }

  // Keep the log short.
  await db.from("push_log").delete().lt("day", addDays(now.toISOString().slice(0, 10), -3));
  return json(200, { sent, removed });
});

/** Send to a phone through Expo. True when the device is gone (uninstalled, token expired). */
async function sendExpo(d: Device, msgs: Message[]): Promise<boolean> {
  const token = Deno.env.get("EXPO_ACCESS_TOKEN");
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(msgs.map((m) => ({ to: d.token, title: m.title, body: m.body, data: { url: m.url }, sound: "default" }))),
    });
    const out = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    return (out.data ?? []).some((t) => t.status === "error" && t.details?.error === "DeviceNotRegistered");
  } catch {
    return false;
  }
}

/** Send to a browser with Web Push. True when the subscription is gone (404/410). */
async function sendWeb(d: Device, msgs: Message[]): Promise<boolean> {
  if (!d.keys?.p256dh || !d.keys.auth) return true;
  for (const m of msgs) {
    try {
      await webpush.sendNotification({ endpoint: d.token, keys: { p256dh: d.keys.p256dh, auth: d.keys.auth } }, JSON.stringify(m), { TTL: 3600 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) return true;
    }
  }
  return false;
}
