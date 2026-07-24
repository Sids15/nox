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
// Deploy:  supabase functions deploy url-meta      (verify_jwt stays on — authed users only)

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"];
const LINK_HOSTS = [
  "github.com", "linkedin.com", "instagram.com", "twitter.com", "x.com",
  "medium.com", "dribbble.com", "behance.net", "figma.com", "reddit.com",
];
const ALLOW = [...VIDEO_HOSTS, ...LINK_HOSTS];

const MAX_BYTES = 512 * 1024; // parse at most the first 512 KB of HTML
const FETCH_TIMEOUT_MS = 6000;

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

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(target.href, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NoxBot/1.0; +https://nox.app)" },
      redirect: "follow",
    });
    clearTimeout(timer);

    // A redirect must not carry us off the allow-list (a trusted host bouncing somewhere internal).
    if (!allowed(hostOf(res.url))) return json(403, { error: "redirected off allow-list" });

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
    console.error("url-meta fetch failed", host, e);
    // A preview is best-effort — a fetch failure is a 200 with nothing, not an error the UI must handle.
    return json(200, { domain: host });
  }
});
