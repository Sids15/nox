import { useEffect } from "react";
import { Platform } from "react-native";

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  if (el.content !== content) el.content = content;
}

/**
 * Phone web chrome. The viewport lets the app paint under the notch and home indicator (screens pad
 * themselves with the safe-area insets) and makes the on-screen keyboard resize the page on Android,
 * so bottom sheets ride above it. `theme-color` paints the status bar / browser chrome in the app's
 * own background, following the Paper / Night switch rather than one fixed colour.
 */
export function useWebViewport(background: string, dark: boolean) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    setMeta("viewport", "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content");
    setMeta("color-scheme", dark ? "dark" : "light");
    setMeta("theme-color", background);
  }, [background, dark]);
}
