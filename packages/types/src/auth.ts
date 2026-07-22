import { z } from "zod";

/** Auth form schemas — used with react-hook-form + @hookform/resolvers/zod. */
export const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});
export type Credentials = z.infer<typeof credentials>;

/** Sign-up adds an optional display name (stored in Supabase user_metadata). */
export const signUpInput = credentials.extend({
  name: z.string().trim().max(80).optional(),
});
export type SignUpInput = z.infer<typeof signUpInput>;

export const magicLinkInput = z.object({
  email: z.string().email().max(320),
});
export type MagicLinkInput = z.infer<typeof magicLinkInput>;

/**
 * Social providers Nox offers. A closed enum rather than Supabase's full `Provider` union so a
 * typo or a caller-supplied string can never reach `signInWithOAuth` and send the user to a
 * provider we never configured.
 */
export const oauthProvider = z.enum(["google", "apple"]);
export type OAuthProvider = z.infer<typeof oauthProvider>;
