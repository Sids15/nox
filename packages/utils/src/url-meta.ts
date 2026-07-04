/** Bare domain from a URL, e.g. "https://www.youtube.com/watch?v=1" → "youtube.com". */
export function domainFrom(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]!
    .toLowerCase();
}

/** Favicon URL for a domain via Google's favicon service. */
export function faviconFor(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
