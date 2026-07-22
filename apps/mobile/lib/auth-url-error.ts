import { Platform } from "react-native";

/**
 * Maps Supabase's machine-readable `error_code` to our own fixed copy.
 *
 * We NEVER render the URL's `error_description`: it is attacker-controllable, so reflecting it
 * verbatim on a trusted in-app screen would let a crafted link display arbitrary phishing text
 * ("call this number to unlock your account").
 */
export function authErrorCopy(errorCode: string | null | undefined): string | null {
  if (!errorCode) return null;
  switch (errorCode) {
    case "otp_expired":
      return "This link has expired or was already used.";
    case "access_denied":
      return "This link is no longer valid.";
    case "exchange_failed":
      // Not one of Supabase's codes — ours, for a link that arrived intact but couldn't be
      // redeemed. Almost always because the flow was started on a different device or surface:
      // the PKCE verifier never leaves the client that began it, by design.
      return "This link couldn't be completed here. Start the request again on this device.";
    default:
      return "This link is invalid or has expired.";
  }
}

function readFromLocation(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "") || window.location.search.replace(/^\?/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  if (!params.get("error") && !params.get("error_code")) return null;
  return params.get("error_code") ?? "unknown";
}

/**
 * The auth error carried by the URL the app was OPENED with, captured at module load.
 *
 * Timing is the whole point of this living at module scope in its own file. supabase-js strips the
 * auth params out of the URL as part of `detectSessionInUrl`, which it kicks off when the client is
 * constructed — before React renders anything. Reading `window.location` from inside a component
 * races that and can lose, leaving a failed link spinning forever. `_layout.tsx` imports this
 * module ahead of `@nox/db` so the read always happens first.
 *
 * Native is always null here (there is no `window.location`); errors arrive there as a route param
 * pushed by the deep-link handler instead.
 */
export const initialAuthErrorCode = readFromLocation();
