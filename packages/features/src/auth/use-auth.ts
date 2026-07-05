import { AuthRepository } from "@nox/api";
import { useEffect } from "react";
import { useSessionStore } from "./session-store";

/**
 * Bootstraps the auth gate by subscribing to auth changes. supabase-js emits an
 * `INITIAL_SESSION` event immediately on subscribe, which resolves the initial session (or
 * null), so no separate getSession() call is needed. Call this exactly once, at the root layout.
 */
export function useAuthBootstrap(): void {
  const setSession = useSessionStore((s) => s.setSession);

  useEffect(() => {
    const unsubscribe = AuthRepository.onAuthStateChange(setSession);
    return unsubscribe;
  }, [setSession]);
}

/** Read auth state + the validated auth actions (delegated to AuthRepository). */
export function useAuth() {
  const session = useSessionStore((s) => s.session);
  const status = useSessionStore((s) => s.status);

  return {
    session,
    status,
    isAuthenticated: status === "authenticated",
    signInWithPassword: AuthRepository.signInWithPassword,
    signUp: AuthRepository.signUp,
    sendMagicLink: AuthRepository.sendMagicLink,
    sendPasswordReset: AuthRepository.sendPasswordReset,
    updatePassword: AuthRepository.updatePassword,
    updateEmail: AuthRepository.updateEmail,
    signOut: AuthRepository.signOut,
  };
}
