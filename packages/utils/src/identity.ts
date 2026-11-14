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

/** Metadata keys a person's name can arrive under: ours (email sign-up), then Google/Apple's. */
const NAME_KEYS = ["display_name", "full_name", "name"] as const;

export interface Identity {
  /** The full display name: what they typed at sign-up, else their provider name, else from email. */
  name: string;
  /** First word of `name`, for greetings ("Good morning, Ada"). */
  firstName: string;
  /** 1–2 uppercase letters for the avatar. */
  initials: string;
}

/**
 * Who the signed-in user is, for display. Prefers a real name from the auth user's metadata — the
 * one typed at sign-up, or the one Google/Apple provide — over guessing from the email address, which
 * is what every screen used to do even when a name was right there.
 */
export function identityFrom(
  email: string | null | undefined,
  metadata?: Record<string, unknown> | null,
): Identity {
  let real = "";
  for (const key of NAME_KEYS) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) {
      real = value.trim().replace(/\s+/g, " ").slice(0, 80);
      break;
    }
  }
  if (!real) {
    const name = displayNameFrom(email);
    return { name, firstName: name, initials: initialsFrom(email) };
  }

  const words = real.split(" ");
  const first = words[0]!;
  const last = words.length > 1 ? words[words.length - 1]! : "";
  // Array.from so a name starting with an emoji or an accented letter isn't split mid-character.
  const letters = last ? `${Array.from(first)[0]}${Array.from(last)[0]}` : Array.from(first).slice(0, 2).join("");
  return { name: real, firstName: first, initials: letters.toUpperCase() };
}
