import { supabase } from "@nox/db";
import {
  credentials,
  magicLinkInput,
  signUpInput,
  type Credentials,
  type MagicLinkInput,
  type SignUpInput,
} from "@nox/types";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

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
        ...(name ? { data: { name } } : {}),
        // Where the "Confirm email" link returns to — the app exchanges the PKCE code there.
        ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
      },
    });
    if (error) throw error;
    return data.session;
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

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
