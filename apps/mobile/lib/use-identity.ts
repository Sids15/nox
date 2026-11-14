import { useSessionStore } from "@nox/features";
import { identityFrom, type Identity } from "@nox/utils";
import { useMemo } from "react";

/** The signed-in user's display identity (name, first name, initials) — see identityFrom. */
export function useIdentity(): Identity & { email: string } {
  const user = useSessionStore((s) => s.session?.user ?? null);
  return useMemo(() => {
    const email = user?.email ?? "";
    return { ...identityFrom(email, user?.user_metadata), email };
  }, [user]);
}
