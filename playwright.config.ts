import { defineConfig, devices } from "@playwright/test"

/**
 * E2E config.
 *
 * - By default, Playwright starts its own `next dev` on :3000 (CI / clean machine).
 * - Set `E2E_BASE_URL` to target an already-running server instead, e.g.
 *   `E2E_BASE_URL=http://localhost:3002 npx playwright test`.
 *
 * Tests assume `DEV_MODE="true"` (auth bypass) and the default seed
 * (`npm run db:seed` → language slug `test-language`).
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
