import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionState {
  session: Session | null;
  status: AuthStatus;
  setSession: (session: Session | null) => void;
}

/** Ephemeral session state (Zustand). The durable token store is the encrypted keystore,
 *  owned by the Supabase client — this only mirrors the current session for the UI. */
export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  status: "loading",
  setSession: (session) =>
    set({ session, status: session ? "authenticated" : "unauthenticated" }),
}));
