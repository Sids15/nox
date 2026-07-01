import { supabase } from "@nox/db";
import {
  credentials,
  magicLinkInput,
  type Credentials,
  type MagicLinkInput,
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

  async signUp(input: Credentials): Promise<Session | null> {
    const creds = credentials.parse(input);
    const { data, error } = await supabase.auth.signUp(creds);
    if (error) throw error;
    return data.session;
  },

  async sendMagicLink(input: MagicLinkInput): Promise<void> {
    const { email } = magicLinkInput.parse(input);
    const { error } = await supabase.auth.signInWithOtp({ email });
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
