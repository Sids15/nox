import { accents, resolveColors, themeVars, type ThemeColors } from "@nox/ui";
import { usePrefs } from "./prefs-store";

/** Concrete colors for the active theme+accent — for JS APIs that can't read Tailwind classes
 *  (Lucide icon `color=`, DateTimePicker, gesture panels, StatusBar). Re-renders on theme/accent change. */
export function useThemeColors(): ThemeColors {
  const theme = usePrefs((s) => s.theme);
  const accent = usePrefs((s) => s.accent);
  return resolveColors(theme, accents[accent]);
}

/** CSS-variable map for the NativeWind `vars()` root wrapper (drives all class-based colors). */
export function useThemeVars(): Record<string, string> {
  const theme = usePrefs((s) => s.theme);
  const accent = usePrefs((s) => s.accent);
  return themeVars(theme, accents[accent]);
}
