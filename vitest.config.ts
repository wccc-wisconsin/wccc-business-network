import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Test runner config.
 *
 * Two aliases, both load-bearing:
 *
 *   "@/..."       — the same path alias tsconfig.json gives the app. Without
 *                   it every import of a module under test fails to resolve,
 *                   because Vitest reads this file rather than tsconfig paths.
 *
 *   "server-only" — the real package throws on import outside a React Server
 *                   Component, which is exactly its job: it is the guard that
 *                   stops lib/appStore.ts (which holds the Supabase service
 *                   role key) from ever being bundled into browser code. Tests
 *                   are neither a server component nor a browser, so it throws
 *                   there too and nothing server-side would be testable.
 *
 *                   Aliasing it to an empty module removes the guard *for the
 *                   test run only*. The app's own build still imports the real
 *                   package and still gets the protection. Do not be tempted to
 *                   remove the `import "server-only"` lines to make tests pass —
 *                   that would trade a real safety property for a config line.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
