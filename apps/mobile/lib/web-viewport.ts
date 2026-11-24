import { useEffect } from "react";
import { Platform } from "react-native";

function setLink(rel: string, href: string) {
  if (document.head.querySelector(`link[rel="${rel}"]`)) return;
  const el = document.createElement("link");
  el.rel = rel;
  el.href = href;
  document.head.appendChild(el);
}

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
 * own background, following the Paper / Night switch rather than one fixed colour. On iPad the app
 * can be added to the home screen and runs full-screen.
 */
export function useWebViewport(background: string, dark: boolean) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    // maximum-scale stops iPad/iPhone Safari zooming the page when a small text field is tapped
    // (pinch-zoom still works: iOS ignores it for gestures).
    setMeta("viewport", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=resizes-content");
    // "Add to Home Screen" on iPad/iPhone: opens full-screen like an app, with the Nox icon.
    setMeta("apple-mobile-web-app-capable", "yes");
    setMeta("mobile-web-app-capable", "yes");
    setMeta("apple-mobile-web-app-title", "Nox");
    setMeta("apple-mobile-web-app-status-bar-style", dark ? "black-translucent" : "default");
    setLink("apple-touch-icon", "/apple-touch-icon.png");
    setLink("manifest", "/manifest.webmanifest");
    setMeta("color-scheme", dark ? "dark" : "light");
    setMeta("theme-color", background);
  }, [background, dark]);
}
