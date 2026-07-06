import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionState {
  session: Session | null;
  status: AuthStatus;
  /** True while a password-recovery session is active (arrived via a reset link). The auth gate keeps
   *  such a user on the reset-password screen instead of dropping them into the app. */
  recovery: boolean;
  setSession: (session: Session | null) => void;
  setRecovery: (recovery: boolean) => void;
}

/** Ephemeral session state (Zustand). The durable token store is the encrypted keystore,
 *  owned by the Supabase client — this only mirrors the current session for the UI. */
export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  status: "loading",
  recovery: false,
  setSession: (session) =>
    set({ session, status: session ? "authenticated" : "unauthenticated" }),
  setRecovery: (recovery) => set({ recovery }),
}));
