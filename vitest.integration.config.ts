import { defineConfig } from "vitest/config";
import path from "node:path";
import { readFileSync } from "node:fs";

// Load .env.local into process.env for integration tests.
try {
  for (const line of readFileSync(path.resolve(__dirname, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false, // tests share the same seed players
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
