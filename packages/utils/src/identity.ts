/** Derive a display identity from an email address, for the profile avatar + Settings card. */

/** The local-part of an email (before "@"), trimmed and lowercased; "" for empty/invalid input. */
function localPart(email: string | null | undefined): string {
  if (!email) return "";
  return email.split("@")[0]!.trim().toLowerCase();
}

/**
 * 1–2 uppercase initials from an email. A local-part split on non-letter separators (`.`, `_`, `-`,
 * `+`) uses the first letter of the first two chunks ("ada.lovelace" → "AL"); otherwise the first two
 * letters ("siddhant" → "SI"). Falls back to "?" when there's nothing usable.
 */
export function initialsFrom(email: string | null | undefined): string {
  const local = localPart(email);
  if (!local) return "?";
  const parts = local.split(/[.\-_+]+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : local.slice(0, 2);
  return letters.toUpperCase() || "?";
}

/** A friendly first name from an email: the first separator-delimited chunk, capitalized. */
export function displayNameFrom(email: string | null | undefined): string {
  const local = localPart(email);
  if (!local) return "You";
  const first = local.split(/[.\-_+]+/).filter(Boolean)[0] ?? local;
  return first[0]!.toUpperCase() + first.slice(1);
}
