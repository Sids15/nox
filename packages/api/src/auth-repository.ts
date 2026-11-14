import { supabase } from "@nox/db";
import {
  credentials,
  magicLinkInput,
  oauthProvider,
  signUpInput,
  type Credentials,
  type MagicLinkInput,
  type OAuthProvider,
  type SignUpInput,
} from "@nox/types";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

/**
 * supabase-js collapses every non-2xx Edge Function response into the same opaque
 * "non-2xx status code" message and hides the real body on `error.context`. Dig it out so the UI
 * can say what actually went wrong, falling back to the generic message if the shape is unfamiliar.
 */
async function functionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Could not delete your account.";
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return fallback;
  try {
    const body = (await context.clone().json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The only module that touches Supabase Auth. Inputs are validated with Zod before hitting the
 * network; errors are surfaced (never swallowed) for the UI to handle.
 */
export const AuthRepository = {
  async signInWithPassword(input: Credentials): Promise<Session | null> {
    const creds = credentials.parse(input);
    const { data, error } = await supabase.auth.signInWithPassword(creds);
    if (error) throw error;
    return data.session;
  },

  async signUp(input: SignUpInput, redirectTo?: string): Promise<Session | null> {
    const { email, password, name } = signUpInput.parse(input);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // `display_name` is the key the handle_new_user trigger copies into public.users (0001), and the
        // one useIdentity reads first. This used to send `name`, which the trigger ignored.
        ...(name ? { data: { display_name: name } } : {}),
        // Where the "Confirm email" link returns to — the app exchanges the PKCE code there.
        ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
      },
    });
    if (error) throw error;
    return data.session;
  },

  /**
   * Begin a social sign-in. Returns the provider's consent URL when `skipRedirect` is set, which is
   * what native and the desktop shell need — they hand that URL to an in-app browser tab / the
   * system browser rather than navigating the app itself. In a plain browser tab `skipRedirect` is
   * false and supabase-js navigates the page, so this never returns.
   *
   * PKCE throughout: the verifier stays on this device and only the `code` travels back through
   * `redirectTo`, which `useAuthDeepLink` (native/desktop) or `detectSessionInUrl` (web) exchanges.
   */
  async signInWithOAuth(
    provider: OAuthProvider,
    redirectTo: string,
    skipRedirect = false,
  ): Promise<string | null> {
    const validated = oauthProvider.parse(provider);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: validated,
      options: { redirectTo, skipBrowserRedirect: skipRedirect },
    });
    if (error) throw error;
    return data?.url ?? null;
  },

  async sendMagicLink(input: MagicLinkInput): Promise<void> {
    const { email } = magicLinkInput.parse(input);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  },

  /**
   * Send a password-reset email. `redirectTo` is where the reset link returns to; the app exchanges
   * the PKCE code there, which yields a recovery session and lets the user set a new password.
   */
  async sendPasswordReset(input: MagicLinkInput, redirectTo?: string): Promise<void> {
    const { email } = magicLinkInput.parse(input);
    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) throw error;
  },

  /**
   * Exchange a PKCE `code` (from a confirmation / reset / OAuth redirect) for a session. The matching
   * code verifier was stored by supabase-js on this device when the flow was initiated, so this
   * completes on the same device it started on.
   */
  async exchangeCodeForSession(code: string): Promise<Session | null> {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  },

  /**
   * Adopt a session handed back directly in a redirect fragment (the implicit shape,
   * `#access_token=…&refresh_token=…`). Used for links that arrive already redeemed rather than as
   * a PKCE `code`. Emits SIGNED_IN — a recovery link therefore needs its recovery flag set by the
   * caller, since no PASSWORD_RECOVERY event will fire.
   */
  async setSessionFromTokens(accessToken: string, refreshToken: string): Promise<Session | null> {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return data.session;
  },

  /** Update the signed-in user's password (validated min length before the call). */
  async updatePassword(newPassword: string): Promise<void> {
    const password = credentials.shape.password.parse(newPassword);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  /** Change the signed-in user's email — Supabase sends a confirmation link to the new address. */
  async updateEmail(newEmail: string): Promise<void> {
    const email = credentials.shape.email.parse(newEmail);
    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw error;
  },

  /**
   * Update the signed-in user's profile metadata: the display name (shown in greetings and the
   * avatar) and when onboarding was finished, which keeps it from showing again on other devices.
   */
  async updateProfile(data: { display_name?: string; onboarded_at?: string }): Promise<void> {
    const clean: Record<string, string> = {};
    if (data.display_name !== undefined) clean.display_name = data.display_name.trim().slice(0, 80);
    if (data.onboarded_at !== undefined) clean.onboarded_at = data.onboarded_at;
    const { error } = await supabase.auth.updateUser({ data: clean });
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Permanently delete the signed-in account and everything it owns. Deleting a user needs the
   * service_role key, which never ships in the client, so the work happens in the `delete-account`
   * Edge Function; invoke() attaches this session's access token, and the function deletes only
   * the account that token belongs to.
   *
   * The local sign-out is `scope: "local"` on purpose: the JWT is already dead server-side by the
   * time this returns, so a normal sign-out's network call would fail and leave the user sitting
   * in an authed shell for an account that no longer exists. Local scope still emits SIGNED_OUT,
   * which clears the query cache and the persisted snapshot.
   */
  async deleteAccount(): Promise<void> {
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error) throw new Error(await functionErrorMessage(error));
    await supabase.auth.signOut({ scope: "local" });
  },

  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /** Subscribe to auth changes (event + session); returns an unsubscribe function. */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return () => data.subscription.unsubscribe();
  },
};
