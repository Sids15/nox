import { usePrefs } from "@nox/features";
import { useEffect } from "react";
import { refreshPush } from "./push";

/** With server reminders on for this device, refresh its push address and time zone once per sign-in. */
export function usePushSync(signedIn: boolean): void {
  const on = usePrefs((s) => s.serverPush);
  useEffect(() => {
    if (signedIn && on) void refreshPush();
  }, [signedIn, on]);
}
