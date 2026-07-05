import { supabase } from "@nox/db";
import {
  credentials,
  magicLinkInput,
  signUpInput,
  type Credentials,
  type MagicLinkInput,
  type SignUpInput,
} from "@nox/types";
import type { Session } from "@supabase/supabase-js";

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

  async signUp(input: SignUpInput): Promise<Session | null> {
    const { email, password, name } = signUpInput.parse(input);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { name } } : undefined,
    });
    if (error) throw error;
    return data.session;
  },

  async sendMagicLink(input: MagicLinkInput): Promise<void> {
    const { email } = magicLinkInput.parse(input);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  },

  /** Send a password-reset email. Completing the reset (deep link) is a later beta slice. */
  async sendPasswordReset(input: MagicLinkInput): Promise<void> {
    const { email } = magicLinkInput.parse(input);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
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

  /** Subscribe to auth changes; returns an unsubscribe function. */
  onAuthStateChange(callback: (session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
    return () => data.subscription.unsubscribe();
  },
};
