import type { AlertButton } from "react-native";

/**
 * Web replacement for React Native's `Alert`. react-native-web's version is `static alert() {}` — a
 * silent no-op — so without this every validation message and confirmation the app raises would be
 * swallowed on web and in the Tauri shell.
 *
 * Maps onto the browser's blocking dialogs: one button (or none) is informational, so `window.alert`;
 * two or more is a decision, so `window.confirm`, where OK runs the first non-cancel button and
 * dismissing runs the cancel-styled one. This is deliberately a stopgap — the dialogs are unstyled
 * and blocking. A themed in-app dialog is the real fix.
 */
function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  const body = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(body);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancel = buttons.find((b) => b.style === "cancel");
  const confirmBtn = buttons.find((b) => b.style !== "cancel") ?? buttons[buttons.length - 1];
  if (window.confirm(body)) confirmBtn?.onPress?.();
  else cancel?.onPress?.();
}

export const Alert = { alert };
