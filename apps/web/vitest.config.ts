import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Component tests in jsdom.
 *
 * Only Client Components are reachable here - a Server Component is an async
 * function that runs on the server and reads cookies, so rendering one in
 * jsdom would be testing a mock of Next.js rather than the app. The server side
 * is covered by the backend's own tests; what these cover is the behaviour that
 * only exists in the browser: a warning arriving over the socket, and the rules
 * design.md sets for how a warning may be shown.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
