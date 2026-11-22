import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve the `@/*` alias from tsconfig.json so tests import like app code.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts"],
      reporter: ["text", "html"],
    },
  },
});
