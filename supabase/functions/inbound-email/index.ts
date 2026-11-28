// Nox — Email to Nox. A Cloudflare Email Worker (cloudflare/email-worker) receives mail for
// <token>@INBOUND_EMAIL_DOMAIN and posts the raw message here with a shared secret.
//
// 1. The secret header must match INBOUND_EMAIL_SECRET (constant-time compare).
// 2. The address's token finds the account (inbound_addresses, migration 0020).
// 3. Unless the account accepts any sender, the From address must be the account's sign-in email.
// 4. Each account may add EMAIL_PER_MINUTE (10) / EMAIL_DAILY_LIMIT (100) a day (hit_rate_limit).
// 5. The email becomes one Inbox item (item.ts): a task (subject + body as notes) or a link.
// Attachments are ignored. Nothing from the email is logged.
//
// Secrets:  INBOUND_EMAIL_SECRET, INBOUND_EMAIL_DOMAIN (e.g. in.nox.app)
// Deploy:   supabase functions deploy inbound-email --no-verify-jwt    (it checks the secret itself)

import { createClient } from "npm:@supabase/supabase-js@2";
import PostalMime from "npm:postal-mime@2";
import { bareAddress, emailToItem, tokenFrom } from "./item.ts";

const MAX_BYTES = 1_000_000;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function same(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").slice(0, 300);
  } catch {
    return null;
  }
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const secret = Deno.env.get("INBOUND_EMAIL_SECRET") ?? "";
  const domain = Deno.env.get("INBOUND_EMAIL_DOMAIN") ?? "";
  if (!secret || !domain) return json(500, { error: "Not configured" });
  if (!same(req.headers.get("x-inbound-secret") ?? "", secret)) return json(401, { error: "Unauthorized" });

  const raw = await req.arrayBuffer();
  if (raw.byteLength > MAX_BYTES) return json(413, { error: "Too big" });

  const token = tokenFrom(req.headers.get("x-nox-to") ?? "", domain);
  if (!token) return json(404, { error: "Unknown address" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "Not configured" });
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: address } = await db.from("inbound_addresses").select("user_id, any_sender").eq("token", token).maybeSingle();
  if (!address) return json(404, { error: "Unknown address" });
  const userId = address.user_id as string;

  let email: { subject?: string; text?: string; from?: { address?: string } };
  try {
    email = await PostalMime.parse(raw);
  } catch {
    return json(400, { error: "Couldn't read that email" });
  }

  if (!address.any_sender) {
    const { data: owner } = await db.auth.admin.getUserById(userId);
    const own = owner?.user?.email?.toLowerCase();
    const from = (email.from?.address ?? bareAddress(req.headers.get("x-nox-from") ?? "") ?? "").toLowerCase();
    if (!own || from !== own) return json(403, { error: "Only mail from your own address is accepted" });
  }

  const { data: verdict } = await db.rpc("hit_rate_limit", {
    p_uid: userId,
    p_bucket: "email",
    p_per_minute: Math.max(1, Number(Deno.env.get("EMAIL_PER_MINUTE")) || 10),
    p_per_day: Math.max(1, Number(Deno.env.get("EMAIL_DAILY_LIMIT")) || 100),
  });
  if (verdict !== "ok") return json(429, { error: "Too many emails today" });

  const item = emailToItem(email.subject ?? "", email.text ?? "");
  if (!item) return json(200, { added: false });

  const { error } =
    item.kind === "link"
      ? await db.from("resources").insert({ user_id: userId, type: "link", url: item.url, title: item.title, domain: domainOf(item.url), inbox: true })
      : await db.from("tasks").insert({ user_id: userId, title: item.title, notes: item.notes, inbox: true });
  if (error) {
    console.error("inbound insert failed", error.code);
    return json(500, { error: "Couldn't save it" });
  }
  return json(200, { added: true, kind: item.kind });
});
