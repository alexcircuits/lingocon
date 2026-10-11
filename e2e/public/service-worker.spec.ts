import { test, expect, signedInAs, type Page } from "../fixtures"
import { E2E_LANGUAGES } from "../data"

/**
 * public/sw.js in a production build (the root layout only registers it when
 * NODE_ENV=production). Its contract: cache content-addressed /_next/static assets
 * only — never HTML documents or RSC payloads (project state) — purge legacy
 * `lingocon-*` caches on activation, and serve /offline.html for failed navigations.
 * Every test gets a fresh browser context, hence a fresh registration and Cache Storage.
 */
const STATIC_CACHE = "lingocon-static-v2"

interface CacheEntry {
  cache: string
  url: string
}

/** Resolves once the worker is active and controls the page (it calls clients.claim()). */
async function waitForController(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller) return
    await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }))
  })
}

function cacheEntries(page: Page): Promise<CacheEntry[]> {
  return page.evaluate(async () => {
    const entries: { cache: string; url: string }[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) entries.push({ cache: name, url: request.url })
    }
    return entries
  })
}

test.describe("service worker", () => {
  test("registers /sw.js at the root scope with updateViaCache 'none'", async ({ page }) => {
    await page.goto("/")
    const registration = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready
      return { script: r.active?.scriptURL ?? "", scope: r.scope, updateViaCache: r.updateViaCache }
    })
    expect(new URL(registration.script).pathname).toBe("/sw.js")
    expect(new URL(registration.scope).pathname).toBe("/")
    expect(registration.updateViaCache).toBe("none")
  })

  test("/sw.js is never served from an HTTP cache", async ({ request }) => {
    const res = await request.get("/sw.js")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("javascript")
    expect(res.headers()["cache-control"]).toContain("no-store")
  })

  test("activation purges legacy lingocon caches but keeps unrelated ones", async ({ page }) => {
    // /offline.html is static and does not register the worker: seed caches before it exists.
    await page.goto("/offline.html")
    expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBe(0)
    await page.evaluate(async () => {
      const legacy = await caches.open("lingocon-v1")
      await legacy.put(
        "/studio/lang/e2e-public/dictionary?_rsc=stale",
        new Response("stale project snapshot", { headers: { "Content-Type": "text/x-component" } })
      )
      const other = await caches.open("other-app-cache")
      await other.put("/other-app", new Response("keep me"))
    })
    expect(await page.evaluate(() => caches.has("lingocon-v1"))).toBe(true)

    await page.goto("/")
    await waitForController(page)
    await expect.poll(() => page.evaluate(() => caches.has("lingocon-v1"))).toBe(false)
    const names = await page.evaluate(() => caches.keys())
    expect(names).toContain(STATIC_CACHE)
    expect(names).toContain("other-app-cache")
  })

  test("an uncached navigation while offline shows the offline page", async ({ page, context }) => {
    await page.goto("/")
    await waitForController(page)
    // Installation precaches the offline page.
    await expect.poll(() => page.evaluate(async () => Boolean(await caches.match("/offline.html")))).toBe(true)

    await context.setOffline(true)
    try {
      await page.goto(`/lang/${E2E_LANGUAGES.public}/grammar/nouns`)
      await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
      await expect(page).toHaveTitle(/Offline/)
    } finally {
      await context.setOffline(false)
    }
  })
})

test.describe("service worker — signed in", () => {
  signedInAs("owner")

  test("browsing the studio and reader caches static assets only, never pages or RSC payloads", async ({ page }) => {
    const studio = `/studio/lang/${E2E_LANGUAGES.public}`
    await page.goto(studio)
    await waitForController(page)
    // Reload so the whole document load (scripts, styles) goes through the active worker.
    await page.reload()

    // Client-side navigations fetch RSC payloads (`?_rsc=`) through the worker.
    const sidebar = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Dictionary" }) }).first()
    for (const section of ["Dictionary", "Grammar", "Alphabet"]) {
      await sidebar.getByRole("link", { name: section, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${studio}/${section.toLowerCase()}$`))
    }
    await page.goto(`/lang/${E2E_LANGUAGES.public}`)
    await page.getByRole("link", { name: "Dictionary", exact: true }).first().click()
    await expect(page).toHaveURL(`/lang/${E2E_LANGUAGES.public}/dictionary`)

    // The worker did cache content-addressed chunks (so it really was in the request path)…
    await expect
      .poll(async () => (await cacheEntries(page)).filter((e) => new URL(e.url).pathname.startsWith("/_next/static/")).length)
      .toBeGreaterThan(0)

    // …and nothing else: no RSC payloads, no HTML documents, no other caches.
    const entries = await cacheEntries(page)
    expect([...new Set(entries.map((e) => e.cache))]).toEqual([STATIC_CACHE])
    const unexpected = entries.filter(({ url }) => {
      const { pathname, search } = new URL(url)
      if (search.includes("_rsc=")) return true
      return !(pathname.startsWith("/_next/static/") || pathname === "/offline.html")
    })
    expect(unexpected, "only /_next/static assets and the offline page may be cached").toEqual([])
    expect(entries.filter((e) => /^\/(studio|lang)(\/|$)/.test(new URL(e.url).pathname))).toEqual([])
  })
})
