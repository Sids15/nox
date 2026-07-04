import { domainFrom, faviconFor } from "@nox/utils";

export interface UrlMeta {
  title?: string;
  image?: string;
  domain: string;
  favicon: string;
}

function decode(s?: string): string | undefined {
  if (!s) return undefined;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function ogContent(html: string, prop: string): string | undefined {
  const a = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i");
  return decode(html.match(a)?.[1] ?? html.match(b)?.[1]);
}

/**
 * Best-effort page metadata for a pasted URL. The domain + favicon are always derived; the title +
 * image are parsed from og-tags when the fetch succeeds (native `fetch` has no CORS). Never throws.
 */
export async function fetchUrlMeta(url: string): Promise<UrlMeta | null> {
  if (!url.trim()) return null;
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  const domain = domainFrom(normalized);
  const meta: UrlMeta = { domain, favicon: faviconFor(domain) };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NoxBot/1.0)" },
    });
    clearTimeout(timer);
    const html = (await res.text()).slice(0, 60_000);
    meta.title =
      ogContent(html, "og:title") ?? decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]);
    meta.image = ogContent(html, "og:image");
  } catch {
    // best-effort — keep the derived domain/favicon
  }
  return meta;
}
