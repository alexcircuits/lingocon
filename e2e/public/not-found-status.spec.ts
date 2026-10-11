import { test, expect } from "../fixtures"
import { E2E_CONTENT, E2E_LANGUAGES } from "../data"

/**
 * Crawlers and links see a real HTTP 404 for every missing public page — not a 200
 * that renders "not found" (a soft 404). Loading skeletons only wrap list pages, so
 * the language layout and detail pages decide before anything is streamed.
 */
const pub = E2E_LANGUAGES.public
const missing = [
  "/lang/does-not-exist-e2e",
  "/lang/does-not-exist-e2e/dictionary",
  `/lang/${E2E_LANGUAGES.private}`,
  `/lang/${E2E_LANGUAGES.private}/grammar`,
  `/lang/${pub}/grammar/no-such-page-e2e`,
  `/lang/${pub}/articles/no-such-article-e2e`,
  `/lang/${pub}/texts/no-such-text-e2e`,
]
const present = [
  `/lang/${pub}`,
  `/lang/${pub}/dictionary`,
  `/lang/${pub}/grammar`,
  `/lang/${pub}/grammar/${E2E_CONTENT.grammarPages[0].slug}`,
  `/lang/${pub}/articles/${E2E_CONTENT.article.slug}`,
  `/lang/${pub}/texts/${E2E_CONTENT.text.slug}`,
]

test.describe("public pages answer with the right HTTP status", () => {
  for (const path of missing) {
    test(`404 for ${path}`, async ({ request }) => {
      const response = await request.get(path, { headers: { accept: "text/html" }, maxRedirects: 0 })
      expect(response.status()).toBe(404)
    })
  }

  for (const path of present) {
    test(`200 for ${path}`, async ({ request }) => {
      const response = await request.get(path, { headers: { accept: "text/html" } })
      expect(response.status()).toBe(200)
    })
  }
})
