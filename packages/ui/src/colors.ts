/**
 * Nox design tokens. The app themes at runtime via NativeWind `vars()` (see the mobile root
 * layout): `themeVars()` feeds the CSS variables that class-based colors resolve against, and
 * `resolveColors()` returns the same theme as concrete JS values for APIs that can't read classes
 * (Lucide icon `color=`, DateTimePicker, gesture panels, StatusBar). Keep both in sync with
 * `tailwind-preset.js` (variable names) and `apps/mobile/global.css` (the :root fallback).
 */

export type ThemeName = "dark" | "light";

/**
 * Ink & Paper. The world is stationery: warm paper, ink-navy type, one stamped accent — vermilion
 * by default, the red of a hanko seal or a diary's date. Night mode is the same notebook under a
 * desk lamp: ink-blue paper, warm off-white type. See DESIGN.md.
 */
export const accents = {
  vermilion: "#D9472B",
  indigo: "#3E5BA9",
  moss: "#4F7A4A",
  plum: "#8A4F7D",
} as const;
export type AccentName = keyof typeof accents;
export const DEFAULT_ACCENT: AccentName = "vermilion";

/** Semantic colors (same across themes), tuned to sit on paper and on ink. */
const SEMANTIC = {
  critical: "#C2362B",
  high: "#D0603C", // also destructive / overdue
  medium: "#B07A1E", // ochre — also carried-over
  success: "#4E8A4F", // also synced
  info: "#4467B8",
} as const;

/**
 * RGB channel triples per theme (consumed as `rgb(var(--x) / <alpha>)`). ink2/ink3 are solid
 * colours, not alpha over ink, so secondary and placeholder text hold 4.5:1 on their own paper.
 */
const PALETTE: Record<ThemeName, Record<string, string>> = {
  light: {
    bg: "245 241 232", // #F5F1E8 paper
    surface: "251 248 241", // #FBF8F1
    elev: "255 253 248", // #FFFDF8
    sheet: "255 253 248",
    ink: "27 33 49", // #1B2131 ink navy
    ink2: "74 80 99", // #4A5063
    ink3: "110 111 119", // #6E6F77
    line: "27 33 49",
    chip: "27 33 49",
    tabbar: "251 248 241",
  },
  dark: {
    bg: "18 21 31", // #12151F ink night
    surface: "24 28 40", // #181C28
    elev: "31 36 51", // #1F2433
    sheet: "28 33 48",
    ink: "237 231 218", // #EDE7DA warm paper white
    ink2: "185 180 168", // #B9B4A8
    ink3: "140 138 134", // #8C8A86
    line: "237 231 218",
    chip: "237 231 218",
    tabbar: "24 28 40",
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
    "--ink-2": p.ink2!,
    "--ink-3": p.ink3!,
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
    ink2: rgb(p.ink2!),
    ink3: rgb(p.ink3!),
    line: rgba(p.line!, 0.1),
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

/** Light + vermilion resolved colors — a static fallback for any non-hook context. */
export const dark: ThemeColors = resolveColors("light", accents.vermilion);
