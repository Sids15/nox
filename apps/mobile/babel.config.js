module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // `unstable_transformImportMeta` rewrites `import.meta` (shipped by some ESM deps, e.g.
      // Supabase) so the web bundle — served as a classic script, not a module — doesn't throw
      // "Cannot use 'import.meta' outside a module" and white-screen.
      ["babel-preset-expo", { jsxImportSource: "nativewind", unstable_transformImportMeta: true }],
      "nativewind/babel",
    ],
    // Reanimated 4 worklet transform — must be listed last.
    plugins: ["react-native-worklets/plugin"],
  };
};
