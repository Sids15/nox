import { notifyNow } from "./desktop-notify";

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Desktop and web: a timeout while Nox is open fires the "Focus done" notification (the desktop app
 * shows a system notification; a plain browser tab shows the finished timer when you look). Replaced
 * on every start/resume, cleared on pause or stop.
 */
export async function setFocusAlert(at: number | null, body: string): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (at === null) return;
  const wait = at - Date.now();
  if (wait <= 0) return;
  timer = setTimeout(() => {
    timer = null;
    void notifyNow("Focus done", body);
  }, wait);
}
