/**
 * Nox design tokens. The app themes at runtime via NativeWind `vars()` (see the mobile root
 * layout): `themeVars()` feeds the CSS variables that class-based colors resolve against, and
 * `resolveColors()` returns the same theme as concrete JS values for APIs that can't read classes
 * (Lucide icon `color=`, DateTimePicker, gesture panels, StatusBar). Keep both in sync with
 * `tailwind-preset.js` (variable names) and `apps/mobile/global.css` (the :root fallback).
 */

export type ThemeName = "dark" | "light";

/** User-selectable accents (default = violet). Accent + semantic colors are theme-independent. */
export const accents = {
  violet: "#7C6FF2",
  green: "#2F9D72",
  coral: "#D2604A",
  blue: "#4C7FE0",
} as const;
export type AccentName = keyof typeof accents;

/** Semantic colors (same across themes). */
const SEMANTIC = {
  critical: "#D64545",
  high: "#D2604A", // also destructive / overdue
  medium: "#C98A2B", // also carried-over
  success: "#2F9D72", // also synced
  info: "#4C7FE0", // also exploring
} as const;

/** RGB channel triples per theme (consumed as `rgb(var(--x) / <alpha>)`). */
const PALETTE: Record<ThemeName, Record<string, string>> = {
  dark: {
    bg: "12 12 19",
    surface: "20 20 29",
    elev: "27 27 38",
    sheet: "24 24 34",
    ink: "241 241 247",
    inkDim: "228 228 245", // base for text2 (.62) / text3 (.34)
    line: "255 255 255",
    chip: "255 255 255",
    tabbar: "23 23 33",
  },
  light: {
    bg: "244 244 247",
    surface: "255 255 255",
    elev: "255 255 255",
    sheet: "255 255 255",
    ink: "23 23 31",
    inkDim: "28 28 42",
    line: "22 22 40",
    chip: "22 22 40",
    tabbar: "255 255 255",
  },
};

/** Semantic hex → "r g b" channel triple. */
function toTriple(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
const rgba = (triple: string, alpha: number) => `rgba(${triple.split(" ").join(", ")}, ${alpha})`;

/**
 * CSS-variable map for NativeWind `vars()`. Applied on a root wrapper so every class-based color
 * (`bg-bg`, `text-ink`, `bg-accent`, `bg-high/[0.09]`…) re-resolves when theme or accent changes.
 */
export function themeVars(theme: ThemeName, accentHex: string): Record<string, string> {
  const p = PALETTE[theme];
  return {
    "--bg": p.bg!,
    "--surface": p.surface!,
    "--elev": p.elev!,
    "--sheet": p.sheet!,
    "--ink": p.ink!,
    "--ink-dim": p.inkDim!,
    "--line": p.line!,
    "--chip": p.chip!,
    "--tabbar": p.tabbar!,
    "--accent": toTriple(accentHex),
    "--on-accent": "255 255 255",
    "--critical": toTriple(SEMANTIC.critical),
    "--high": toTriple(SEMANTIC.high),
    "--medium": toTriple(SEMANTIC.medium),
    "--success": toTriple(SEMANTIC.success),
    "--info": toTriple(SEMANTIC.info),
  };
}

export interface ThemeColors {
  bg: string;
  surface: string;
  elev: string;
  sheet: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  chip: string;
  tabbar: string;
  accent: string;
  onAccent: string;
  critical: string;
  high: string;
  medium: string;
  success: string;
  info: string;
}

/** Concrete colors for the active theme+accent, for JS consumers (icons, pickers, native chrome). */
export function resolveColors(theme: ThemeName, accentHex: string): ThemeColors {
  const p = PALETTE[theme];
  const rgb = (triple: string) => `rgb(${triple.split(" ").join(", ")})`;
  return {
    bg: rgb(p.bg!),
    surface: rgb(p.surface!),
    elev: rgb(p.elev!),
    sheet: rgb(p.sheet!),
    ink: rgb(p.ink!),
    ink2: rgba(p.inkDim!, 0.62),
    ink3: rgba(p.inkDim!, 0.34),
    line: rgba(p.line!, 0.075),
    chip: rgba(p.chip!, 0.06),
    tabbar: rgba(p.tabbar!, 0.86),
    accent: accentHex,
    onAccent: "#FFFFFF",
    ...SEMANTIC,
  };
}

/** @react-navigation/native Theme (typed inline to avoid a hard dep). System font per the handoff. */
export function navThemeFor(theme: ThemeName, accentHex: string) {
  const c = resolveColors(theme, accentHex);
  return {
    dark: theme === "dark",
    colors: {
      primary: c.accent,
      background: c.bg,
      card: c.surface,
      text: c.ink,
      border: c.line,
      notification: c.accent,
    },
    fonts: {
      regular: { fontFamily: "System", fontWeight: "400" },
      medium: { fontFamily: "System", fontWeight: "500" },
      bold: { fontFamily: "System", fontWeight: "700" },
      heavy: { fontFamily: "System", fontWeight: "800" },
    },
  } as const;
}

/** Dark + violet resolved colors — a static fallback for any non-hook context. */
export const dark: ThemeColors = resolveColors("dark", accents.violet);
