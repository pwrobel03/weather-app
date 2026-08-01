import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Node-environment tests for the logic layer: session renewal, the alert
 * socket, alert resolution, stored preferences.
 *
 * Deliberately not rendering React Native components. @testing-library/
 * react-native targets Jest, and react-native ships untranspiled Flow, so
 * running it under Vitest means owning a transform pipeline - a large amount
 * of build machinery guarding components that are mostly layout. The parts
 * that can actually be wrong at 3am are here, and they are plain TypeScript.
 *
 * The stubs stand in for native modules that have no Node implementation.
 * Each one is a few lines; the alternative is not testing this layer at all.
 */
export default defineConfig({
  resolve: {
    alias: {
      "expo-constants": path.resolve(__dirname, "test/stubs/expo-constants.ts"),
      "expo-secure-store": path.resolve(__dirname, "test/stubs/expo-secure-store.ts"),
      "react-native": path.resolve(__dirname, "test/stubs/react-native.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
