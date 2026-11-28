import { PushRepository } from "@nox/api";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { ensurePermission } from "./notifications";

/** Expo push tokens need the app's EAS project id (app.json → extra.eas.projectId, from `eas init`). */
const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Whether this build can receive server reminders at all. */
export const pushAvailable = !!projectId;
export const pushUnavailableReason = "This build isn't set up for push yet (it needs an EAS project).";

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

async function token(): Promise<string | null> {
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/** Turn server reminders on for this phone. Returns an error to show, or null. */
export async function enablePush(): Promise<string | null> {
  if (!projectId) return pushUnavailableReason;
  if (!(await ensurePermission())) return "Notifications are off for Nox in your phone's settings.";
  const t = await token();
  if (!t) return "Couldn't get a push address for this phone. Try again later.";
  try {
    await PushRepository.register({ kind: "expo", token: t, tz: timeZone() });
    return null;
  } catch {
    return "Couldn't save this phone. Check your connection (and that migration 0019 has run).";
  }
}

/** Turn them off here (also on sign-out, so the next person doesn't get them). */
export async function disablePush(): Promise<void> {
  const t = await token();
  if (t) await PushRepository.unregister(t).catch(() => {});
}

/** Refresh the registration (token and time zone) quietly, e.g. at app start. */
export async function refreshPush(): Promise<void> {
  const t = await token();
  if (t) await PushRepository.register({ kind: "expo", token: t, tz: timeZone() }).catch(() => {});
}
