import { AuthRepository } from "@nox/api";
import { queryClient, queryPersister } from "@nox/db";
import { useEffect } from "react";
import { useSessionStore } from "./session-store";

/**
 * Bootstraps the auth gate by subscribing to auth changes. supabase-js emits an
 * `INITIAL_SESSION` event immediately on subscribe, which resolves the initial session (or
 * null), so no separate getSession() call is needed. A `PASSWORD_RECOVERY` event (fired when a
 * reset link is exchanged) raises the recovery flag so the gate holds the user on the reset screen.
 * Call this exactly once, at the root layout.
 */
export function useAuthBootstrap(): void {
  const setSession = useSessionStore((s) => s.setSession);
  const setRecovery = useSessionStore((s) => s.setRecovery);

  useEffect(() => {
    const unsubscribe = AuthRepository.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      else if (event === "SIGNED_OUT") {
        setRecovery(false);
        // Purge cached data AND any queued offline writes so nothing crosses an account boundary on
        // a shared device: without this, a write queued by the previous user would replay under the
        // next user's session (creating their private content in the new account), and cached rows
        // would linger. clear() empties both caches in memory; removeClient() drops the persisted
        // snapshot so a queued write can't resume on the next launch either.
        queryClient.clear();
        void queryPersister.removeClient();
      }
    });
    return unsubscribe;
  }, [setSession, setRecovery]);
}

/** Read auth state + the validated auth actions (delegated to AuthRepository). */
export function useAuth() {
  const session = useSessionStore((s) => s.session);
  const status = useSessionStore((s) => s.status);
  const recovery = useSessionStore((s) => s.recovery);
  const setRecovery = useSessionStore((s) => s.setRecovery);

  return {
    session,
    status,
    isAuthenticated: status === "authenticated",
    recovery,
    setRecovery,
    signInWithPassword: AuthRepository.signInWithPassword,
    signUp: AuthRepository.signUp,
    sendMagicLink: AuthRepository.sendMagicLink,
    sendPasswordReset: AuthRepository.sendPasswordReset,
    exchangeCodeForSession: AuthRepository.exchangeCodeForSession,
    updatePassword: AuthRepository.updatePassword,
    updateEmail: AuthRepository.updateEmail,
    signOut: AuthRepository.signOut,
    deleteAccount: AuthRepository.deleteAccount,
  };
}
