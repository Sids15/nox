import { usePrefs, type HeadingFont } from "@nox/features";
import { useEffect } from "react";
import { Platform } from "react-native";

/** The CSS font stacks behind each heading style. Only fonts that ship with the OS — nothing to download. */
export const HEADING_STACKS: Record<HeadingFont, { family: string; tracking: string }> = {
  // The system UI font, tightened a little at display sizes.
  sans: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', tracking: "-0.022em" },
  // Charter (macOS, iOS) and its nearest relatives elsewhere: an even, open serif, lighter than Georgia.
  modern: { family: 'Charter, "Bitstream Charter", "Iowan Old Style", "Palatino Linotype", Palatino, Cambria, Georgia, serif', tracking: "-0.012em" },
  classic: { family: 'Georgia, "Iowan Old Style", ui-serif, "Times New Roman", serif', tracking: "-0.01em" },
};

/**
 * Applies the chosen heading typeface on the web by setting two CSS variables that global.css's
 * `.font-serif` rule reads, so every title in the app follows it at once. (Native keeps the built-in
 * serif for now: its font families are compiled into the class.)
 */
export function useHeadingFont() {
  const choice = usePrefs((s) => s.headingFont);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const { family, tracking } = HEADING_STACKS[choice] ?? HEADING_STACKS.sans;
    document.documentElement.style.setProperty("--nox-display", family);
    document.documentElement.style.setProperty("--nox-display-tracking", tracking);
  }, [choice]);
}
