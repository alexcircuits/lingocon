import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test"

type WebServer = Extract<NonNullable<PlaywrightTestConfig["webServer"]>, { command: string }>

/**
 * E2E against a production build with real sign-in (see e2e/README.md).
 *
 * - Playwright starts `next start` on :3100 (after `npm run build`), or targets an
 *   already-running server when E2E_BASE_URL is set.
 * - The server needs DEV_MODE="false", AUTH_SECRET, AUTH_TRUST_HOST and a database
 *   prepared with `prisma migrate deploy`, `npm run db:seed` and `npx tsx e2e/seed.ts`.
 * - E2E_RUST=1 also starts the Rust service (rust/target/release/lingocon-api) and
 *   routes the studio overview's analysis to it; the same specs must pass either way.
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3100"
const port = new URL(baseURL).port || "3100"
const withRust = process.env.E2E_RUST === "1"
const rustToken = process.env.LINGOCON_API_TOKEN || "e2e-local-service-token-0123456789abcdef"

const rustServer: WebServer = {
  command: "rust/target/release/lingocon-api",
  url: "http://127.0.0.1:3040/readyz",
  env: { LINGOCON_API_TOKEN: rustToken, LINGOCON_API_BIND: "127.0.0.1:3040", RUST_LOG: "warn" },
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
}

const nextServer: WebServer = {
  command: `npm run start -- -p ${port}`,
  url: baseURL,
  env: {
    // The middleware's old-slug lookup calls back into the server on 127.0.0.1:$PORT
    // (3000 by default, which may be another app on a developer machine).
    PORT: port,
    ...(withRust ? { LINGOCON_API_URL: "http://127.0.0.1:3040", LINGOCON_API_TOKEN: rustToken } : {}),
  },
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: process.env.CI ? 15_000 : 10_000 },
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : withRust ? [rustServer, nextServer] : [nextServer],
})
