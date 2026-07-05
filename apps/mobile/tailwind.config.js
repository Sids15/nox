const noxPreset = require("../../packages/ui/tailwind-preset.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  // `class` dark mode (not the default `media`) so the runtime theme toggle can call
  // colorScheme.set() on web — otherwise NativeWind's web runtime throws. We drive colors via
  // CSS vars, not `dark:` variants, so this only enables the manual toggle.
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset"), noxPreset],
};
