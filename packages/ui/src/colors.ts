/**
 * "Lamplight" — Nox's dark-only design tokens (runtime source of truth for JS/TS).
 * NOTE: keep these hex values in sync with ../tailwind-preset.js (Tailwind consumer).
 */
export const lamplight = {
  bg: "#12110E",
  surface: "#1C1A17",
  elevated: "#24211D",
  border: "#2E2A25",
  ink: {
    primary: "#F3EEE3",
    secondary: "#B8B0A1",
    muted: "#8A8375",
    inverse: "#12110E",
  },
  accent: "#7B61FF",
  accentMuted: "#5B49B8",
  success: "#7B9A7A",
  warning: "#D4A35F",
  critical: "#D16A5E",
  destructive: "#C8483C",
} as const;

/** Structural shape matching @react-navigation/native's Theme (typed here to avoid
 *  a hard dependency in the tokens package). */
export const navTheme = {
  dark: true,
  colors: {
    primary: lamplight.accent,
    background: lamplight.bg,
    card: lamplight.surface,
    text: lamplight.ink.primary,
    border: lamplight.border,
    notification: lamplight.accent,
  },
  fonts: {
    regular: { fontFamily: "Geist", fontWeight: "400" },
    medium: { fontFamily: "Geist", fontWeight: "500" },
    bold: { fontFamily: "Geist", fontWeight: "700" },
    heavy: { fontFamily: "Geist", fontWeight: "800" },
  },
} as const;
