import { test as base, expect, type Page } from "@playwright/test"
import { authFile, type E2eRole } from "./data"

/**
 * Test fixture that records uncaught client-side errors. Any page that throws a
 * React render/hydration error (the kind a 200 SSR response hides) will fail the
 * assertion in `expectNoPageErrors`.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text())
    })
    await use(errors)
  },
})

/** Filter out noise we don't control (favicon, font 404s, ResizeObserver loop). */
const IGNORED = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Failed to load resource/i, // asset 404s (fonts/images) — not app errors
  /Download the React DevTools/i,
  // Background polls (session, notifications, achievements) aborted by page.goto mid-flight.
  /Failed to fetch/i,
]

export function expectNoPageErrors(errors: string[]) {
  const real = errors.filter((e) => !IGNORED.some((re) => re.test(e)))
  expect(real, `unexpected client errors:\n${real.join("\n")}`).toEqual([])
}

/**
 * Run the enclosing `describe` (or file) signed in as a fixture role — the session
 * e2e/auth.setup.ts obtained through /login. Without it, tests run signed out.
 */
export function signedInAs(role: E2eRole): void {
  test.use({ storageState: authFile(role) })
}

/** A short unique suffix for names and slugs created by a test. */
export function unique(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export { expect, type Page }
