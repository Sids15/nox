import { GcalRepository } from "@nox/api";
import { isTauri } from "@nox/db";
import { openExternal } from "./open-external";

/**
 * Browser: go to Google's consent page in this tab; it comes back to Settings with ?gcal=connected.
 * Desktop app: open it in the default browser (it returns to nox://settings); Settings re-checks
 * when the window comes back into focus.
 */
export async function connectGoogleCalendar(): Promise<"connected" | "cancelled" | "error" | "pending"> {
  try {
    if (isTauri()) {
      await openExternal(await GcalRepository.start("nox://settings"));
      return "pending";
    }
    window.location.assign(await GcalRepository.start(`${window.location.origin}/settings`));
    return "pending";
  } catch {
    return "error";
  }
}
