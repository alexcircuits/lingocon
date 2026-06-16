import { test as base, expect, type Page } from "@playwright/test"

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
]

export function expectNoPageErrors(errors: string[]) {
  const real = errors.filter((e) => !IGNORED.some((re) => re.test(e)))
  expect(real, `unexpected client errors:\n${real.join("\n")}`).toEqual([])
}

export { expect, type Page }
