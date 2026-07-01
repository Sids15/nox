// Lamplight Tailwind preset — consumed by each app's tailwind.config.js via NativeWind.
// NOTE: keep hex values in sync with ./src/colors.ts (the runtime token source).
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: "#12110E",
        surface: "#1C1A17",
        elevated: "#24211D",
        border: "#2E2A25",
        ink: {
          DEFAULT: "#F3EEE3",
          secondary: "#B8B0A1",
          muted: "#8A8375",
          inverse: "#12110E",
        },
        accent: {
          DEFAULT: "#7B61FF",
          muted: "#5B49B8",
        },
        success: "#7B9A7A",
        warning: "#D4A35F",
        critical: "#D16A5E",
        destructive: "#C8483C",
      },
      fontFamily: {
        sans: ["Geist", "sans-serif"],
        mono: ["GeistMono", "monospace"],
      },
      borderRadius: {
        badge: "4px",
        input: "8px",
        card: "12px",
      },
      spacing: {
        // 8px base grid
        grid: "8px",
      },
    },
  },
};
