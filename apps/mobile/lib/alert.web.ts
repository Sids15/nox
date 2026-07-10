import type { AlertButton } from "react-native";
import { pushAlert } from "./alert-queue";

/**
 * Web replacement for React Native's `Alert`. react-native-web ships `static alert() {}` — a silent
 * no-op — so without this every validation message and confirmation the app raises would be swallowed
 * on web and in the Tauri shell.
 *
 * Same fire-and-forget signature as RN's, so call sites are identical across platforms. The request is
 * queued and rendered by `DialogHost` as a themed in-app modal, rather than a blocking `window.alert`.
 */
function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  pushAlert(title, message, buttons);
}

export const Alert = { alert };
