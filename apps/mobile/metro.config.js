// Expo's Metro config auto-detects npm/yarn/pnpm/bun workspaces since SDK 52
// — no manual watchFolders/nodeModulesPaths/disableHierarchicalLookup needed.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
