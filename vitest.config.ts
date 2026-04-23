import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "threads",
    maxWorkers: 1,
    minWorkers: 1,
    isolate: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      include: [
        "src/lib/**/*.ts",
        "src/app/api/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "src/lib/db/index.ts",
        "src/lib/redis.ts",
        "src/lib/stripe.ts",
        "src/lib/twilio.ts",
        "src/lib/auth.ts",
      ],
      thresholds: {
        lines: 60,
        functions: 55,
        statements: 60,
        branches: 50,
        "src/lib/pricing.ts": { lines: 90, functions: 90, statements: 90, branches: 80 },
        "src/lib/billing/credits.ts": { lines: 80, functions: 80, statements: 80, branches: 70 },
        "src/lib/campaigns/tcpa.ts": { lines: 85, functions: 85, statements: 85, branches: 75 },
        "src/lib/campaigns/csv-parser.ts": { lines: 80, functions: 80, statements: 80, branches: 70 },
      },
    },
  },
});
