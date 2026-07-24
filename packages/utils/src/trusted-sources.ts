/**
 * The allow-list that gates link previews and inline video.
 *
 * A preview means fetching (or embedding) third-party content, so we do it ONLY for a curated set of
 * hosts we trust — anything else gets no preview at all, by design. Two payoffs: we never reflect a
 * thumbnail/title from an arbitrary attacker-controlled page, and we never even attempt the metadata
 * fetch for a random URL. The client and the `url-meta` Edge Function both enforce this list.
 */

/** Video hosts we can embed and thumbnail deterministically (or via the meta proxy). */
const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"] as const;

/** Link hosts we'll attempt an og:image/title preview for. Some (LinkedIn, Instagram) gate scrapers
 *  and will simply yield no image — that degrades to "no preview", which is the intended fallback. */
const LINK_HOSTS = [
  "github.com",
  "linkedin.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "medium.com",
  "dribbble.com",
  "behance.net",
  "figma.com",
  "reddit.com",
] as const;

/**
 * Bare registrable host, lower-cased, `www.` and any `userinfo@`/`:port` stripped. Returns "" for an
 * unparseable value. Regex-based rather than `new URL()` so `@nox/utils` needs no DOM lib.
 */
export function hostOf(url: string): string {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  const m = withScheme.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^/@?#]*@)?([^/:?#]+)/i);
  if (!m) return "";
  const host = m[1]!.toLowerCase().replace(/^www\./, "");
  // A real host is dot-separated alphanumeric-hyphen labels with at least one letter — rejects junk.
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host) && /[a-z]/.test(host) ? host : "";
}

/** True when `host` is the registrable domain or a subdomain of it (never a suffix-collision like
 *  `evil-github.com` or `github.com.evil.com`). */
function matches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export type SourceKind = "video" | "link";

export interface TrustedSource {
  kind: SourceKind;
  /** The matched registrable domain, e.g. "youtube.com". */
  domain: string;
  /** Deterministic embed URL for inline playback (video hosts only). */
  embedUrl?: string;
  /** Deterministic thumbnail URL requiring no network fetch (YouTube only). */
  thumbnailUrl?: string;
}

/** The 11-char YouTube id from any of its URL shapes, or null. */
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1]! : null;
}

/** The numeric Vimeo id, or null. */
function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1]! : null;
}

/**
 * Classify a URL against the allow-list. Returns null for anything untrusted — the caller shows no
 * preview and no inline player for those.
 */
export function classifySource(url: string): TrustedSource | null {
  const host = hostOf(url);
  if (!host) return null;

  const video = VIDEO_HOSTS.find((d) => matches(host, d));
  if (video) {
    if (video === "youtube.com" || video === "youtu.be") {
      const id = youtubeId(url);
      if (!id) return { kind: "video", domain: "youtube.com" };
      return {
        kind: "video",
        domain: "youtube.com",
        // -nocookie: no tracking cookies until the user actually presses play.
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    }
    const id = vimeoId(url);
    return {
      kind: "video",
      domain: "vimeo.com",
      ...(id ? { embedUrl: `https://player.vimeo.com/video/${id}` } : {}),
    };
  }

  const link = LINK_HOSTS.find((d) => matches(host, d));
  if (link) return { kind: "link", domain: link };

  return null;
}

/** Whether a preview may be attempted for this URL at all. */
export function isTrustedSource(url: string): boolean {
  return classifySource(url) !== null;
}
