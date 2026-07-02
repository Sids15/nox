// Nox Tailwind preset — consumed by each app's tailwind.config.js via NativeWind.
// Colors resolve to CSS variables (RGB channel triples) defined in apps/mobile/global.css, so a
// single theme flip (dark/light) or an accent swap re-tints every class at runtime. Keep the
// variable names in sync with global.css and the resolved hex in ./src/colors.ts.
//
// `rgb(var(--x) / <alpha-value>)` lets utilities like `bg-accent/40` set opacity; tokens with a
// baked alpha (text2/text3/line/chip/tabbar/*-soft) encode the handoff's exact translucency.
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;
const a = (v, alpha) => `rgb(var(${v}) / ${alpha})`;

module.exports = {
  theme: {
    extend: {
      colors: {
        bg: c("--bg"),
        surface: c("--surface"),
        elev: c("--elev"),
        sheet: c("--sheet"),
        tabbar: a("--tabbar", 0.86),

        // Text ramp (handoff: text / text2 .62 / text3 .34).
        ink: {
          DEFAULT: c("--ink"),
          2: a("--ink-dim", 0.62),
          3: a("--ink-dim", 0.34),
          // compat aliases for pre-handoff placeholder screens
          secondary: a("--ink-dim", 0.62),
          muted: a("--ink-dim", 0.34),
        },

        line: a("--line", 0.075),
        chip: a("--chip", 0.06),
        border: a("--line", 0.075), // alias so existing `border-border` keeps resolving

        accent: {
          DEFAULT: c("--accent"),
          soft: a("--accent", 0.14), // tinted fill
          line: a("--accent", 0.4), // tinted border
        },
        "on-accent": c("--on-accent"),

        // Semantic — each with a 13% tinted-background companion.
        critical: { DEFAULT: c("--critical"), soft: a("--critical", 0.13) },
        high: { DEFAULT: c("--high"), soft: a("--high", 0.13) },
        medium: { DEFAULT: c("--medium"), soft: a("--medium", 0.13) },
        success: { DEFAULT: c("--success"), soft: a("--success", 0.13) },
        info: { DEFAULT: c("--info"), soft: a("--info", 0.13) },
        destructive: c("--high"), // alias: destructive == high/coral
      },
      fontFamily: {
        // System UI font per the handoff (SF Pro on iOS). Mono for labels/counts/timestamps —
        // Menlo is the iOS system monospace; revisit for Android in the Windows/Android pass.
        sans: ["System"],
        mono: ["Menlo"],
      },
      borderRadius: {
        badge: "6px",
        input: "12px",
        card: "16px",
        sheet: "28px",
        thumb: "10px",
        fab: "18px",
        pill: "999px",
      },
      spacing: {
        screen: "20px", // mobile horizontal screen padding
      },
    },
  },
};
