/**
 * Nox design tokens — runtime source of truth for JS/native consumers (nav theme, StatusBar,
 * gesture-panel fills) that can't read Tailwind classes. Values mirror the hi-fi handoff
 * (design/README.md) and the CSS variables in apps/mobile/global.css / tailwind-preset.js.
 *
 * Dark-first: only the dark theme is resolved here today. The light theme + runtime accent
 * switching land with the Settings slice; when they do, these become theme-aware lookups.
 */

/** User-selectable accents (default = violet). Tints are derived at 12–18% (bg) / 35–45% (border). */
export const accents = {
  violet: "#7C6FF2",
  green: "#2F9D72",
  coral: "#D2604A",
  blue: "#4C7FE0",
} as const;
export type AccentName = keyof typeof accents;

/** Resolved dark-theme values. */
export const dark = {
  bg: "#0C0C13",
  surface: "#14141D",
  elev: "#1B1B26",
  sheet: "#181822",
  ink: "#F1F1F7",
  ink2: "rgba(228,228,245,0.62)",
  ink3: "rgba(228,228,245,0.34)",
  line: "rgba(255,255,255,0.075)",
  chip: "rgba(255,255,255,0.06)",
  tabbar: "rgba(23,23,33,0.86)",
  accent: accents.violet,
  onAccent: "#FFFFFF",
  // semantic (priority / status / state)
  critical: "#D64545",
  high: "#D2604A", // also destructive / overdue
  medium: "#C98A2B", // also carried-over
  success: "#2F9D72", // also synced
  info: "#4C7FE0",
} as const;
export type ThemeColors = typeof dark;

/** Structural shape matching @react-navigation/native's Theme (typed inline to avoid a hard
 *  dependency in the tokens package). System font per the handoff — no bundled typeface. */
export const navTheme = {
  dark: true,
  colors: {
    primary: dark.accent,
    background: dark.bg,
    card: dark.surface,
    text: dark.ink,
    border: dark.line,
    notification: dark.accent,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "800" },
  },
} as const;
