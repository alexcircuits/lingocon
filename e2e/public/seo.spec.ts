import { test, expect } from "../fixtures"
import { E2E_CONTENT, E2E_LANGUAGES } from "../data"
import { metaContent } from "./helpers"

/**
 * Crawler-facing surface. Production builds always emit the canonical site origin
 * (lingocon.com) — never localhost — so URLs are asserted by path.
 */
test.describe("robots.txt and sitemap.xml", () => {
  test("robots.txt allows public areas, blocks private ones and points at the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toContain("text/plain")
    const body = await res.text()
    expect(body).toMatch(/User-Agent: \*/i)
    expect(body).toContain("Allow: /lang/")
    for (const path of ["/api/", "/studio/", "/dashboard/", "/settings/", "/admin/"]) {
      expect(body).toContain(`Disallow: ${path}`)
    }
    expect(body).toMatch(/^Sitemap: https?:\/\/[^\s]+\/sitemap\.xml$/m)
    expect(body).not.toContain("localhost")
  })

  test("sitemap.xml lists public language pages and nothing private", async ({ request }) => {
    const res = await request.get("/sitemap.xml")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toMatch(/xml/)
    const xml = await res.text()
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)

    const pub = `/lang/${E2E_LANGUAGES.public}`
    expect(locs).toContain(pub)
    expect(locs).toContain(`${pub}/dictionary`)
    expect(locs).toContain(`${pub}/grammar/${E2E_CONTENT.grammarPages[0].slug}`)
    expect(locs).toContain("/browse")
    expect(locs.filter((path) => path.includes(E2E_LANGUAGES.private))).toEqual([])
    expect(locs.filter((path) => /^\/(studio|dashboard|settings|admin|api)(\/|$)/.test(path))).toEqual([])
    expect(xml).not.toContain("localhost")
  })
})

test.describe("language page metadata", () => {
  const BASE = `/lang/${E2E_LANGUAGES.public}`

  test("home has a canonical link, Open Graph and Twitter tags", async ({ page, request }) => {
    await page.goto(BASE)
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
    expect(canonical).toMatch(/^https:\/\//)
    expect(new URL(canonical!).pathname).toBe(BASE)

    expect(await metaContent(page, "og:title")).toContain("E2E Public Tongue")
    expect(await metaContent(page, "og:description")).toContain("E2E fixture language")
    expect(await metaContent(page, "og:url")).toBe(canonical)
    expect(await metaContent(page, "og:type")).toBe("website")
    expect(await metaContent(page, "twitter:card")).toBe("summary_large_image")
    expect(await metaContent(page, "robots")).toMatch(/(^|,\s*)index/)

    // The Open Graph image is generated per language and actually renders.
    const ogImage = await metaContent(page, "og:image")
    expect(ogImage).toBeTruthy()
    const image = await request.get(new URL(ogImage!).pathname)
    expect(image.status()).toBe(200)
    expect(image.headers()["content-type"]).toBe("image/png")
  })

  for (const sub of ["/dictionary", "/grammar", `/grammar/${E2E_CONTENT.grammarPages[0].slug}`, "/alphabet"]) {
    test(`${sub} has its own canonical URL and og:title`, async ({ page }) => {
      await page.goto(`${BASE}${sub}`)
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
      expect(new URL(canonical!).pathname).toBe(`${BASE}${sub}`)
      expect(await metaContent(page, "og:title")).toContain("E2E Public Tongue")
    })
  }

  test("an article is described as an article", async ({ page }) => {
    await page.goto(`${BASE}/articles/${E2E_CONTENT.article.slug}`)
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
    expect(new URL(canonical!).pathname).toBe(`${BASE}/articles/${E2E_CONTENT.article.slug}`)
    expect(await metaContent(page, "og:type")).toBe("article")
    expect(await metaContent(page, "og:title")).toContain(E2E_CONTENT.article.title)
  })

  test("not-found and account pages are not indexable", async ({ page }) => {
    const response = await page.goto(`/lang/${E2E_LANGUAGES.private}`)
    // A real 404, carrying Next's noindex (next to the site-wide default; crawlers apply the
    // most restrictive robots directive).
    expect(response?.status()).toBe(404)
    const robots = await page.locator('meta[name="robots"]').evaluateAll((metas) => metas.map((m) => m.getAttribute("content") ?? ""))
    expect(robots.some((content) => content.includes("noindex"))).toBe(true)
    await page.goto("/login")
    expect(await metaContent(page, "robots")).toContain("noindex")
  })
})
