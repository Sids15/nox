import { router, type Href } from "expo-router";

/**
 * Back, or — when there is nothing to go back to — to `fallback`. A screen opened directly (a link
 * on the web, a page refresh, a reminder tapped on a cold start) has no history, and plain
 * `router.back()` then does nothing: the back button and "delete" both left you stuck on the screen.
 */
export function goBack(fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
