// Metro config for the Bun-workspace monorepo + NativeWind.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so changes in packages/* trigger reloads.
config.watchFolders = [workspaceRoot];
// Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// Cargo's build output lives inside the watched workspace (apps/desktop/src-tauri). It creates and
// deletes temp directories constantly while compiling, and Metro's watcher crashes with an ENOENT
// from fs.watch when one vanishes between the crawl and the watch. `tauri dev` starts Metro and the
// Rust build at the same time, so this is the common case, not a rare race. `resolver.blockList`
// becomes metro-file-map's ignorePattern, which governs the crawler and the watcher alike.
const rustBuildOutput = /[\\/]apps[\\/]desktop[\\/]src-tauri[\\/](target|gen)[\\/]/;
const existing = config.resolver.blockList;
config.resolver.blockList = existing
  ? [...(Array.isArray(existing) ? existing : [existing]), rustBuildOutput]
  : [rustBuildOutput];

module.exports = withNativeWind(config, { input: "./global.css" });
