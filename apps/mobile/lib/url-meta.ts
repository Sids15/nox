import { domainFrom, faviconFor } from "@nox/utils";

export interface UrlMeta {
  title?: string;
  image?: string;
  domain: string;
  favicon: string;
}

/** A deterministic thumbnail for known video hosts (YouTube), used when og:image can't be fetched. */
export function videoThumbnail(url: string): string | undefined {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
  return undefined;
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
    meta.title = (
      ogContent(html, "og:title") ?? decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1])
    )?.slice(0, 500);
    // Keep normal thumbnail URLs; drop absurd ones (e.g. inline data URIs) so a save can't be rejected.
    const image = ogContent(html, "og:image");
    meta.image = image && image.length <= 3000 ? image : undefined;
  } catch {
    // best-effort — keep the derived domain/favicon
  }
  return meta;
}
