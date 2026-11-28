/**
 * "Save to Nox" bookmarklet: a bookmark whose address is a tiny script. Clicked on any page, it opens
 * Nox's "Add to Nox" in a small window with that page's address, title and any selected text — the
 * same screen the share sheet opens. It sends nothing anywhere else.
 */
export function bookmarkletCode(base: string): string {
  const origin = base.replace(/\/+$/, "");
  const script = [
    "(()=>{",
    "const e=encodeURIComponent,",
    "s=String(getSelection?getSelection():'').trim().slice(0,1000),",
    `u='${origin}/add?url='+e(location.href)+'&title='+e(document.title.slice(0,300))+(s?'&text='+e(s):'');`,
    "window.open(u,'nox-add','width=560,height=680')||(location.href=u)",
    "})()",
  ].join("");
  return `javascript:${script}`;
}

/** Where the bookmarklet should open Nox: the configured web address, else this page's own (http/https). */
export function bookmarkletBase(configured: string | undefined, origin: string | null): string | null {
  const pick = (configured ?? "").trim() || origin || "";
  return /^https?:\/\/[^\s'"\\]+$/i.test(pick) ? pick.replace(/\/+$/, "") : null;
}
