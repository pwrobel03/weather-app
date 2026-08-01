const path = require("node:path");

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

/**
 * Monorepo wiring. Metro's default config assumes the app is its own root, and
 * under pnpm that means `@weather-app/core` resolves to nothing: the package
 * lives outside projectRoot and reaches the app through a symlink, neither of
 * which the default watcher or resolver looks at.
 */

// Watch the whole workspace, so editing packages/core triggers a reload.
config.watchFolders = [workspaceRoot];

// Resolve from both node_modules trees. pnpm keeps each package's real
// dependencies in its own directory and hoists only some to the root, so
// neither path alone is sufficient.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Symlink resolution (which is pnpm's entire layout) is on by default in
// expo/metro-config, so it is deliberately not set here - expo-doctor flags an
// explicit `unstable_enableSymlinks` as an override of a value Expo now owns.

// Note: `disableHierarchicalLookup` is the usual advice for a monorepo, to
// stop a hoisted second copy of react being picked up alongside the app's own.
// It is wrong here. pnpm gives each package its own node_modules holding its
// real dependencies, and walking up to find them is the whole mechanism -
// disabling it makes expo unable to resolve expo-modules-core. The duplicate
// it guards against is a symptom of hoisting, which pnpm does not do.

module.exports = withNativeWind(config, { input: "./global.css" });
