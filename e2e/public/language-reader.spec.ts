import { test, expect, expectNoPageErrors } from "../fixtures"
import { E2E_CONTENT, E2E_LANGUAGES } from "../data"
import { db } from "../db"

/** The public reader (/lang/[slug]/…) of the PUBLIC fixture language, signed out. */
const SLUG = E2E_LANGUAGES.public
const BASE = `/lang/${SLUG}`
const NAME = "E2E Public Tongue"

/** Live counts, so other suites adding content to the fixture language cannot break these. */
async function contentCounts(): Promise<{ entries: number; symbols: number }> {
  const where = { language: { slug: SLUG } }
  const [entries, symbols] = await Promise.all([db().dictionaryEntry.count({ where }), db().scriptSymbol.count({ where })])
  return { entries, symbols }
}

test.describe("public language reader", () => {
  test("home shows the language, its sections and maintainer", async ({ page, pageErrors }) => {
    const response = await page.goto(BASE)
    expect(response?.status()).toBe(200)
    const main = page.getByRole("main")
    await expect(main.getByRole("heading", { level: 1, name: NAME })).toBeVisible()
    await expect(main.getByText(`${NAME} — E2E fixture language.`)).toBeVisible()
    await expect(main.getByText("E2E Owner").first()).toBeVisible()
    const counts = await contentCounts()
    await expect(main.getByText(new RegExp(`\\b${counts.entries}\\s*Words`))).toBeVisible()
    await expect(main.getByText(new RegExp(`\\b${counts.symbols}\\s*Symbols`))).toBeVisible()

    const sectionNav = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Overview" }) })
    for (const [label, path] of [
      ["Alphabet", "alphabet"],
      ["Grammar", "grammar"],
      ["Dictionary", "dictionary"],
      ["Paradigms", "paradigms"],
      ["Articles", "articles"],
      ["Texts", "texts"],
    ] as const) {
      await expect(sectionNav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", `${BASE}/${path}`)
    }
    expectNoPageErrors(pageErrors)
  })

  test("alphabet lists the script with IPA", async ({ page, pageErrors }) => {
    await page.goto(`${BASE}/alphabet`)
    const main = page.getByRole("main")
    await expect(main.getByRole("heading", { name: "Alphabet" })).toBeVisible()
    for (const symbol of ["a", "k", "l"]) {
      await expect(main.getByText(`/${symbol}/`, { exact: true })).toBeVisible()
    }
    await expect(main.getByRole("button", { name: /play ipa pronunciation/i })).toHaveCount((await contentCounts()).symbols)
    expectNoPageErrors(pageErrors)
  })

  test("dictionary lists every entry and opens entry details", async ({ page, pageErrors }) => {
    await page.goto(`${BASE}/dictionary`)
    await expect(page.getByRole("heading", { level: 1, name: "Dictionary" })).toBeVisible()
    for (const lemma of E2E_CONTENT.entries) {
      await expect(page.getByRole("button", { name: `Show details for ${lemma}` })).toBeVisible()
    }
    await page.getByRole("button", { name: "Show details for tama" }).click()
    const details = page.getByRole("dialog")
    await expect(details).toContainText("tama")
    await expect(details).toContainText(E2E_CONTENT.glosses.tama)
    await expect(details).toContainText("/ˈtama/")
    await expect(details).toContainText("noun")
    await details.getByRole("button", { name: "Close" }).click()
    await expect(details).toBeHidden()
    expectNoPageErrors(pageErrors)
  })

  test("dictionary search is server-rendered and linkable", async ({ page, request, pageErrors }) => {
    // The filtered list is in the HTML itself (no client fetch needed).
    const html = await (await request.get(`${BASE}/dictionary?q=tama`)).text()
    expect(html).toContain("Show details for tama")
    expect(html).not.toContain("Show details for kelo")

    await page.goto(`${BASE}/dictionary?q=tama`)
    await expect(page.getByRole("searchbox", { name: "Search the dictionary" })).toHaveValue("tama")
    await expect(page.getByRole("button", { name: "Show details for tama" })).toBeVisible()
    await expect(page.getByRole("button", { name: /^Show details for / })).toHaveCount(1)

    // Typing updates the URL (debounced) and the server-filtered list.
    await page.getByRole("searchbox", { name: "Search the dictionary" }).fill("kelo")
    await expect(page).toHaveURL(/[?&]q=kelo/)
    await expect(page.getByRole("button", { name: "Show details for kelo" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Show details for tama" })).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("grammar index links to pages whose content is in the server HTML", async ({ page, request, pageErrors }) => {
    await page.goto(`${BASE}/grammar`)
    await expect(page.getByRole("heading", { level: 1, name: "Grammar" })).toBeVisible()
    const [intro, nouns] = E2E_CONTENT.grammarPages
    await expect(page.getByRole("link", { name: new RegExp(nouns.title) })).toHaveAttribute("href", `${BASE}/grammar/${nouns.slug}`)

    await page.getByRole("link", { name: new RegExp(intro.title) }).click()
    await expect(page).toHaveURL(`${BASE}/grammar/${intro.slug}`)
    const main = page.getByRole("main")
    await expect(main.getByRole("heading", { level: 1, name: intro.title })).toBeVisible()
    await expect(main.getByText(intro.text)).toBeVisible()
    // Next/previous navigation leads on to the second page.
    await expect(main.getByRole("navigation").getByRole("link", { name: nouns.title })).toHaveAttribute(
      "href",
      `${BASE}/grammar/${nouns.slug}`
    )

    const html = await (await request.get(`${BASE}/grammar/${intro.slug}`)).text()
    expect(html).toContain(intro.text)
    expect(html).toMatch(new RegExp(`<h1[^>]*>${intro.title}</h1>`))
    expectNoPageErrors(pageErrors)
  })

  test("paradigms render as tables", async ({ page, pageErrors }) => {
    await page.goto(`${BASE}/paradigms`)
    const main = page.getByRole("main")
    await expect(main.getByRole("heading", { level: 1, name: "Paradigm Tables" })).toBeVisible()
    await expect(main.getByRole("heading", { name: E2E_CONTENT.paradigm })).toBeVisible()
    await expect(main.getByText("Regular verbs.")).toBeVisible()
    await expect(main.getByRole("row", { name: "1sg -a" })).toBeVisible()
    await expect(main.getByRole("row", { name: "3sg -i" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("phonology shows the inventories from the language metadata", async ({ page, pageErrors }) => {
    await page.goto(`${BASE}/phonology`)
    const main = page.getByRole("main")
    await expect(main.getByRole("heading", { name: "Phonology" })).toBeVisible()
    await expect(main.getByText(/8 consonants/)).toBeVisible()
    await expect(main.getByText(/5 vowels/)).toBeVisible()
    await expect(main.getByRole("heading", { name: "Consonant Inventory" })).toBeVisible()
    await expect(main.getByRole("row", { name: /^Plosive p t k$/ })).toBeVisible()
    await expect(main.getByRole("heading", { name: "Syllable Structure" })).toBeVisible()
    await expect(main.getByText("(C)V(C)").first()).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("articles index and a published article", async ({ page, pageErrors }) => {
    const { slug, title } = E2E_CONTENT.article
    await page.goto(`${BASE}/articles`)
    await expect(page.getByRole("heading", { level: 1, name: "Articles & News" })).toBeVisible()
    await page.getByRole("main").getByRole("link", { name: new RegExp(title) }).click()
    await expect(page).toHaveURL(`${BASE}/articles/${slug}`)
    const article = page.getByRole("article")
    await expect(article.getByRole("heading", { level: 1, name: title })).toBeVisible()
    await expect(article).toContainText("Published article body for E2E.")
    await expect(article).toContainText("E2E Owner")
    expectNoPageErrors(pageErrors)
  })

  test("texts index and a published text", async ({ page, pageErrors }) => {
    const { slug, title } = E2E_CONTENT.text
    await page.goto(`${BASE}/texts`)
    await expect(page.getByRole("heading", { level: 1, name: "Texts & Books" })).toBeVisible()
    await page.getByRole("main").getByRole("link", { name: new RegExp(title) }).click()
    await expect(page).toHaveURL(`${BASE}/texts/${slug}`)
    const text = page.getByRole("article")
    await expect(text.getByRole("heading", { level: 1, name: title })).toBeVisible()
    await expect(text).toContainText("Tama suna kelo.")
    expectNoPageErrors(pageErrors)
  })

  test("an unknown article or text is not found", async ({ page }) => {
    await page.goto(`${BASE}/articles/no-such-article`)
    await expect(page.getByText("Page not found", { exact: true })).toBeVisible()
    await page.goto(`${BASE}/texts/no-such-text`)
    await expect(page.getByText("Page not found", { exact: true })).toBeVisible()
  })

  test("flashcards start a practice session from the dictionary", async ({ page, pageErrors }) => {
    await page.goto(`${BASE}/flashcards`)
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`${NAME}.*Quick Practice`) })).toBeVisible()
    const total = Math.min((await contentCounts()).entries, 25) // the default deck is 25 cards
    await page.getByRole("button", { name: `Start Studying (${total} cards)` }).click()

    await expect(page.getByRole("link", { name: "Exit" })).toHaveAttribute("href", BASE)
    await expect(page.getByText(`1/${total}`, { exact: true })).toBeVisible()
    // One card at a time: its front is one of the language's lemmas. Flip it, then grade it.
    const lemmas = await db().dictionaryEntry.findMany({ where: { language: { slug: SLUG } }, select: { lemma: true } })
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const front = page.getByText(new RegExp(`^(${lemmas.map((e) => escape(e.lemma)).join("|")})$`)).first()
    await expect(front).toBeVisible()
    await front.click()
    await page.getByRole("button", { name: /Knew It/ }).click()
    await expect(page.getByText(`2/${total}`, { exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})

/** `test-language` comes from prisma/seed.ts (npm run db:seed), not from e2e/seed.ts. */
test.describe("seeded demo language", () => {
  test("home renders (with a family-tree fetch that degrades gracefully)", async ({ page, pageErrors }) => {
    await page.goto("/lang/test-language")
    await expect(page.getByRole("heading", { level: 1, name: /Test Language/i })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("dictionary shows its seeded entries", async ({ page, pageErrors }) => {
    await page.goto("/lang/test-language/dictionary")
    await expect(page.getByRole("button", { name: "Show details for hello" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Show details for world" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})
