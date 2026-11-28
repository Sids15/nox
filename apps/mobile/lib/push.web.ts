import { PushRepository } from "@nox/api";
import { isTauri } from "@nox/db";

/**
 * Browsers: Web Push through a service worker (public/sw.js) and this project's VAPID public key
 * (EXPO_PUBLIC_VAPID_PUBLIC_KEY). The desktop app can't receive web push; it shows its own local
 * reminders instead.
 */
const vapid = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const pushAvailable =
  typeof window !== "undefined" && !isTauri() && !!vapid && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const pushUnavailableReason = isTauri()
  ? "The desktop app uses its own reminders; server reminders are for phones and browsers."
  : !vapid
    ? "Server reminders aren't set up for the web yet (they need a VAPID key)."
    : "This browser can't receive push notifications.";

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid) as BufferSource });
}

async function save(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("bad subscription");
  await PushRepository.register({ kind: "web", token: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, tz: timeZone() });
}

export async function enablePush(): Promise<string | null> {
  if (!pushAvailable) return pushUnavailableReason;
  if ((await Notification.requestPermission()) !== "granted") return "Notifications are blocked for this site in your browser.";
  try {
    const sub = await subscription(true);
    if (!sub) return "Couldn't subscribe this browser.";
    await save(sub);
    return null;
  } catch {
    return "Couldn't turn on push here. Check your connection (and that migration 0019 has run).";
  }
}

export async function disablePush(): Promise<void> {
  if (!pushAvailable) return;
  try {
    const sub = await subscription(false);
    if (!sub) return;
    await PushRepository.unregister(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* best-effort */
  }
}

export async function refreshPush(): Promise<void> {
  if (!pushAvailable || Notification.permission !== "granted") return;
  try {
    const sub = await subscription(false);
    if (sub) await save(sub);
  } catch {
    /* best-effort */
  }
}
