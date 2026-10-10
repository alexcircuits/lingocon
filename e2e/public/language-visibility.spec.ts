import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { E2E_CONTENT, E2E_LANGUAGES, type E2eRole } from "../data"
import { createScratchLanguage, db, type ScratchLanguage } from "../db"
import { expectNotFoundPage } from "./helpers"

/**
 * The public reader is for PUBLIC and UNLISTED languages only. A PRIVATE language's
 * /lang pages are not found for everyone — the studio shows "View public page" disabled
 * for private projects ("Public pages 404 for private projects"). The one exception is
 * the owner previewing a single article or text (drafts and private languages are
 * visible to their owner there).
 */
const PRIVATE_BASE = `/lang/${E2E_LANGUAGES.private}`
const PRIVATE_NAME = "E2E Private Tongue"

/**
 * `checkPayload: false` for the owner: the language layout (rendered before the page
 * decides it is not found) may carry the owner's own language name in its payload.
 */
async function expectPrivateLanguageHidden(page: Page, path: string, checkPayload = true): Promise<void> {
  await page.goto(path)
  await expectNotFoundPage(page)
  await expect(page.getByText(PRIVATE_NAME)).toHaveCount(0)
  // For anyone else nothing about the language may leak into the HTML or RSC payload.
  if (checkPayload) expect(await page.content()).not.toContain(PRIVATE_NAME)
}

test.describe("private language — signed out", () => {
  for (const sub of ["", "/dictionary", "/grammar/introduction", `/articles/${E2E_CONTENT.article.slug}`]) {
    test(`${PRIVATE_BASE}${sub} is not found`, async ({ page }) => {
      await expectPrivateLanguageHidden(page, `${PRIVATE_BASE}${sub}`)
    })
  }

  test("dictionary search on a private language returns no HTML content", async ({ request }) => {
    const html = await (await request.get(`${PRIVATE_BASE}/dictionary?q=tama`)).text()
    expect(html).not.toContain("Show details for tama")
    expect(html).not.toContain(PRIVATE_NAME)
  })
})

for (const role of ["stranger", "viewer", "editor"] as const satisfies readonly E2eRole[]) {
  test.describe(`private language — ${role}`, () => {
    signedInAs(role)

    test("home and articles are not found in the public reader", async ({ page }) => {
      await expectPrivateLanguageHidden(page, PRIVATE_BASE)
      await expectPrivateLanguageHidden(page, `${PRIVATE_BASE}/articles/${E2E_CONTENT.article.slug}`)
    })
  })
}

test.describe("private language — owner", () => {
  signedInAs("owner")

  test("section pages are not found (private projects have no public pages)", async ({ page }) => {
    await expectPrivateLanguageHidden(page, PRIVATE_BASE, false)
    await expectPrivateLanguageHidden(page, `${PRIVATE_BASE}/dictionary`, false)
  })

  test("the owner can preview an article and a text", async ({ page, pageErrors }) => {
    await page.goto(`${PRIVATE_BASE}/articles/${E2E_CONTENT.article.slug}`)
    await expect(page.getByRole("article").getByRole("heading", { level: 1, name: E2E_CONTENT.article.title })).toBeVisible()
    await page.goto(`${PRIVATE_BASE}/texts/${E2E_CONTENT.text.slug}`)
    await expect(page.getByRole("article").getByRole("heading", { level: 1, name: E2E_CONTENT.text.title })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})

test.describe("unlisted language", () => {
  let language: ScratchLanguage

  test.beforeAll(async () => {
    language = await createScratchLanguage("owner", {
      visibility: "UNLISTED",
      entries: [{ lemma: "veski", gloss: "lantern" }],
    })
  })

  test.afterAll(async () => {
    await db().language.delete({ where: { id: language.id } })
  })

  test("is readable by link but noindexed and kept out of browse and search", async ({ page, request, pageErrors }) => {
    const response = await page.goto(`/lang/${language.slug}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("main").getByRole("heading", { level: 1, name: language.name })).toBeVisible()
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()

    await page.goto(`/lang/${language.slug}/dictionary`)
    await expect(page.getByRole("button", { name: "Show details for veski" })).toBeVisible()
    expectNoPageErrors(pageErrors)

    await page.goto(`/browse?q=${encodeURIComponent(language.name)}`)
    await expect(page.getByRole("heading", { level: 1, name: "Browse" })).toBeVisible()
    await expect(page.locator(`a[href="/lang/${language.slug}"]`)).toHaveCount(0)

    const search = JSON.stringify(await (await request.get("/api/search?q=veski&scope=all")).json())
    expect(search).not.toContain(language.slug)
  })
})
