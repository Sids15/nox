import { supabase } from "@nox/db";
import { classifySource, domainFrom, faviconFor } from "@nox/utils";

export interface UrlMeta {
  title?: string;
  image?: string;
  domain: string;
  favicon: string;
  /** Whether this URL is a trusted source eligible for a preview / inline video. */
  trusted: boolean;
}

function normalize(url: string): string {
  return /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
}

/** Deterministic thumbnail with no network call (YouTube). Undefined for everything else. */
export function videoThumbnail(url: string): string | undefined {
  return classifySource(url)?.thumbnailUrl;
}

/**
 * Best-effort preview metadata for a pasted URL.
 *
 * Previews are gated to trusted hosts (`classifySource`): an untrusted URL gets its domain/favicon
 * and nothing else — no title, no image, and NO network request is made for it at all. That is the
 * deliberate "no preview for random sites" policy, and also means we never fetch an
 * attacker-controlled page.
 *
 * Trusted hosts resolve title/image through the `url-meta` Edge Function, because the client cannot
 * read a cross-origin page (CORS) and the desktop CSP blocks the direct fetch — the function does it
 * server-side. YouTube additionally yields an instant thumbnail with no round-trip. Never throws.
 */
export async function fetchUrlMeta(url: string): Promise<UrlMeta | null> {
  if (!url.trim()) return null;
  const normalized = normalize(url);
  const domain = domainFrom(normalized);
  const source = classifySource(normalized);
  const meta: UrlMeta = { domain, favicon: faviconFor(domain), trusted: source !== null };

  if (!source) return meta; // untrusted → domain/favicon only, no fetch
  if (source.thumbnailUrl) meta.image = source.thumbnailUrl; // instant YouTube thumbnail

  try {
    const { data } = await supabase.functions.invoke("url-meta", { body: { url: normalized } });
    const d = data as { title?: string; image?: string } | null;
    if (d?.title) meta.title = d.title;
    if (d?.image && !meta.image) meta.image = d.image;
  } catch {
    // best-effort — keep the domain/favicon (+ any deterministic thumbnail)
  }
  return meta;
}
