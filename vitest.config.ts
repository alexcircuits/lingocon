/// <reference types="vitest" />
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "prisma"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/actions/**/*.ts", "components/**/*.tsx"],
      exclude: [
        "**/__tests__/**",
        "**/*.test.*",
        "**/index.ts",
        "lib/prisma.ts",
      ],
      thresholds: {
        // Ratchet up as coverage improves
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
