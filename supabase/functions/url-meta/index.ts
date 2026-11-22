// Nox — server-side link preview fetcher.
//
// The client cannot fetch a third-party page for its og:image/title: browsers and the Tauri webview
// block cross-origin reads (CORS), and the desktop CSP pins connect-src to Supabase. So the fetch
// happens here, server-side, where neither applies.
//
// Gated HARD to an allow-list of trusted hosts (mirrored from packages/utils/trusted-sources). This
// is the SSRF boundary: without it, a signed-in user could point the function at an internal address
// (169.254.169.254, localhost, a private range) and read the response. Only https, only these hosts.
//
// Callers are checked against Supabase Auth here too (not only by the platform's verify_jwt), and
// each account may make URL_META_PER_MINUTE (default 20) / URL_META_DAILY_LIMIT (default 300)
// previews — hit_rate_limit(), migration 0010 — so the function can't be used to hammer the sites
// on the list from Supabase's addresses.
//
// Deploy:  supabase functions deploy url-meta      (verify_jwt stays on — authed users only)

import { createClient } from "npm:@supabase/supabase-js@2";

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"];
const LINK_HOSTS = [
  "github.com", "linkedin.com", "instagram.com", "twitter.com", "x.com",
  "medium.com", "dribbble.com", "behance.net", "figma.com", "reddit.com",
];
const ALLOW = [...VIDEO_HOSTS, ...LINK_HOSTS];

const MAX_BYTES = 512 * 1024; // parse at most the first 512 KB of HTML
const FETCH_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Registrable-domain or subdomain match — never a suffix collision (`github.com.evil.com`). */
function allowed(host: string): boolean {
  return ALLOW.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Fetch `start`, following redirects by hand so EVERY hop is checked against the allow-list before
 * it is requested. `redirect: "follow"` only lets us inspect the final URL after the fact — by then
 * the request to wherever a trusted host bounced us (an internal address, the metadata endpoint) has
 * already been made, which is the SSRF this function exists to prevent. Returns null when a hop
 * leaves https or the allow-list, or the chain is too long.
 */
async function fetchOnAllowList(start: URL, signal: AbortSignal): Promise<Response | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current.href, {
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NoxBot/1.0; +https://nox.app)" },
      redirect: "manual",
    });
    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get("location");
    await res.body?.cancel();
    if (!location) return null;

    let next: URL;
    try {
      next = new URL(location, current); // Location may be relative
    } catch {
      return null;
    }
    if (next.protocol !== "https:" || !allowed(hostOf(next.href))) return null;
    current = next;
  }
  return null;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function ogContent(html: string, prop: string): string | undefined {
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(a)?.[1] ?? html.match(b)?.[1];
  return m ? decode(m) : undefined;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  if (Number(req.headers.get("content-length") ?? 0) > 8 * 1024) return json(413, { error: "too large" });

  // Who's asking, checked with Supabase Auth; then their rate limit.
  const auth = req.headers.get("Authorization");
  const sbUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!auth?.startsWith("Bearer ")) return json(401, { error: "sign in first" });
  if (!sbUrl || !anonKey || !serviceKey) return json(500, { error: "server misconfigured" });
  const caller = createClient(sbUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json(401, { error: "sign in first" });
  const admin = createClient(sbUrl, serviceKey, { auth: { persistSession: false } });
  const num = (name: string, fallback: number) => Math.max(1, Number(Deno.env.get(name)) || fallback);
  const { data: verdict, error: limitError } = await admin.rpc("hit_rate_limit", {
    p_uid: user.id,
    p_bucket: "url_meta",
    p_per_minute: num("URL_META_PER_MINUTE", 20),
    p_per_day: num("URL_META_DAILY_LIMIT", 300),
  });
  // Without migration 0010 the check can't run; previews are low-risk, so fail open rather than
  // break link cards — the host allow-list above is the real boundary.
  if (!limitError && verdict !== "ok") return json(429, { error: "too many previews — try again in a minute" });

  let url: unknown;
  try {
    url = (await req.json())?.url;
  } catch {
    return json(400, { error: "invalid body" });
  }
  if (typeof url !== "string" || !url) return json(400, { error: "url required" });

  // https only — no http, no file:, no gopher:, nothing that could reach an internal service.
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return json(400, { error: "invalid url" });
  }
  if (target.protocol !== "https:") return json(400, { error: "https only" });

  const host = hostOf(target.href);
  if (!allowed(host)) return json(403, { error: "host not allowed" });

  // One deadline for the whole exchange — every redirect hop AND the body read. Clearing it once the
  // headers arrived (as this used to) left a slow-dripping body free to hold the function open.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchOnAllowList(target, controller.signal);
    if (!res) return json(403, { error: "redirected off allow-list" });

    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        html += decoder.decode(value, { stream: true });
        if (received >= MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }

    const title = (ogContent(html, "og:title") ?? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? ""))
      ?.slice(0, 500) || undefined;
    const rawImage = ogContent(html, "og:image") ?? ogContent(html, "twitter:image");
    // Only surface a normal https image URL, length-capped so a save can't be rejected downstream.
    const image = rawImage && /^https:\/\//i.test(rawImage) && rawImage.length <= 2000 ? rawImage : undefined;

    return json(200, { title, image, domain: host });
  } catch (e) {
    console.error("url-meta fetch failed", host, e instanceof Error ? e.name : "unknown");
    // A preview is best-effort — a fetch failure is a 200 with nothing, not an error the UI must handle.
    return json(200, { domain: host });
  } finally {
    clearTimeout(timer);
  }
});
