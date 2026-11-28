import { GcalRepository } from "@nox/api";
import * as WebBrowser from "expo-web-browser";

/** Phones: Google's consent page in the system's auth browser, back to nox://settings. */
export async function connectGoogleCalendar(): Promise<"connected" | "cancelled" | "error" | "pending"> {
  const back = "nox://settings";
  try {
    const url = await GcalRepository.start(back);
    const r = await WebBrowser.openAuthSessionAsync(url, back);
    if (r.type !== "success") return "cancelled";
    return r.url.includes("gcal=connected") ? "connected" : "error";
  } catch {
    return "error";
  }
}
