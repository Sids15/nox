import { AuthRepository } from "@nox/api";
import { useEffect } from "react";
import { useSessionStore } from "./session-store";

/**
 * Bootstraps the auth gate: loads the persisted session once and subscribes to auth changes.
 * Call this exactly once, at the root layout.
 */
export function useAuthBootstrap(): void {
  const setSession = useSessionStore((s) => s.setSession);

  useEffect(() => {
    let active = true;

    AuthRepository.getSession()
      .then((session) => {
        if (active) setSession(session);
      })
      .catch(() => {
        if (active) setSession(null);
      });

    const unsubscribe = AuthRepository.onAuthStateChange((session) => {
      if (active) setSession(session);
    });

    return () => {
      active = false;
      unsubscribe();
    };
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
    signOut: AuthRepository.signOut,
  };
}
