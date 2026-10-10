import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { E2E_CONTENT, E2E_LANGUAGES } from "../data"
import { db } from "../db"
import { SWADESH_LIST, matchSwadeshList } from "../../lib/data/swadesh-list"
import {
  cleanupScratch,
  expectSidebarCounts,
  languageCounts,
  scratchLanguage,
  sidebar,
  studioPath,
} from "./helpers"

/**
 * Studio overview. Tests tagged @overview also run with the Rust service computing the
 * lexicon analysis (E2E_RUST=1) and must pass unchanged: expectations are derived from
 * the database with the TypeScript reference (lib/data/swadesh-list), never from the
 * implementation under test.
 */
signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))

async function lexicon(languageId: string) {
  const [entries, symbols] = await Promise.all([
    db().dictionaryEntry.findMany({ where: { languageId }, select: { lemma: true, gloss: true } }),
    db().scriptSymbol.findMany({ where: { languageId }, select: { symbol: true, capitalSymbol: true } }),
  ])
  return { entries, symbols }
}

/**
 * Lemmas using a character outside a single-character alphabet (whitespace, digits,
 * punctuation and symbols are always allowed) — what the validator flags when the
 * alphabet has no digraphs and diacritics mode is off.
 */
function lemmasWithUndefinedSymbols(
  entries: { lemma: string }[],
  symbols: { symbol: string; capitalSymbol: string | null }[]
): string[] {
  const allowed = new Set(symbols.flatMap((s) => [s.symbol, s.capitalSymbol].filter((c): c is string => !!c)))
  return entries
    .filter((entry) => [...entry.lemma.normalize("NFC")].some((ch) => !allowed.has(ch) && !/[\s\d\p{P}\p{S}]/u.test(ch)))
    .map((entry) => entry.lemma)
}

function swadeshCard(page: Page) {
  return page.locator("div.rounded-lg, div.rounded-xl").filter({ has: page.getByRole("heading", { name: /Swadesh List/ }) }).last()
}

function warningsToggle(page: Page) {
  return page.getByRole("button", { name: /^\d+ Validation Warnings?$/ })
}

test.describe("studio overview", () => {
  test("@overview e2e-public: counts, Swadesh coverage and warnings match the lexicon", async ({ page, pageErrors }) => {
    const language = await db().language.findUniqueOrThrow({ where: { slug: E2E_LANGUAGES.public } })
    await page.goto(studioPath(language.slug))
    await expect(page.getByRole("heading", { level: 1, name: language.name })).toBeVisible()

    // Other specs may add to the shared fixture concurrently: compare against a fresh read,
    // reloading if a concurrent write landed between the read and the render.
    await expect(async () => {
      const [counts, { entries, symbols }] = await Promise.all([languageCounts(language.id), lexicon(language.id)])
      const { matched, total } = matchSwadeshList(entries.map((entry) => entry.gloss))
      const flagged = lemmasWithUndefinedSymbols(entries, symbols)
      await page.reload()
      await expectSidebarCounts(page, counts)
      await expect(swadeshCard(page).getByRole("heading", { name: /Swadesh List/ })).toContainText(`${matched.size}/${total}`, {
        timeout: 5_000,
      })
      if (flagged.length === 0) {
        await expect(warningsToggle(page)).toHaveCount(0)
      } else {
        await expect(warningsToggle(page)).toHaveText(
          `${flagged.length} Validation Warning${flagged.length === 1 ? "" : "s"}`
        )
      }
    }).toPass({ timeout: 45_000 })

    // The seeded glosses water, fire, sun, hand and "to see" are Swadesh concepts.
    const seeded = matchSwadeshList(Object.values(E2E_CONTENT.glosses))
    expect(seeded.matched.size).toBe(5)
    expect(SWADESH_LIST).toHaveLength(seeded.total)

    // "Show missing words" lists unmatched concepts only.
    const card = swadeshCard(page)
    await card.getByRole("button", { name: "Show missing words" }).click()
    const list = card.locator("[data-radix-scroll-area-viewport]")
    await expect(list).toBeVisible()
    await expect(list.getByText("water", { exact: true })).toHaveCount(0)
    await expect(list.getByText("louse", { exact: true })).toBeVisible()
    await card.getByRole("button", { name: "Hide details" }).click()
    await expect(list).toHaveCount(0)

    // A category lists all its concepts, matched ones struck through.
    await card.getByRole("button", { name: /^Nature\s*\d+\/\d+$/ }).click()
    await expect(card.locator("span.line-through").getByText("water", { exact: true })).toBeVisible()
    await expect(card.locator("span.line-through").getByText("fire", { exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("@overview validation warnings: collapsed count, expandable list, dismissal persists", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage({
      entries: [
        { lemma: "kala", gloss: "stone" },
        { lemma: "xoqa", gloss: "water" },
        { lemma: "pemi", gloss: "fire" },
        { lemma: "nemi", gloss: "name" },
      ],
    })
    await page.goto(studioPath(language.slug))
    await expect(page.getByRole("heading", { level: 1, name: language.name })).toBeVisible()
    await expectSidebarCounts(page, { Entries: 4, Pages: 0, Symbols: 11, Paradigms: 0 })

    const toggle = warningsToggle(page)
    await expect(toggle).toHaveText("2 Validation Warnings")
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    const xoqa = page.getByText('• Entry "xoqa" uses undefined symbols: x, q')
    const pemi = page.getByText('• Entry "pemi" uses undefined symbols: p')
    await expect(xoqa).toHaveCount(0)

    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(xoqa).toBeVisible()
    await expect(pemi).toBeVisible()
    await expect(page.getByText('Entry "kala"')).toHaveCount(0)

    await toggle.click()
    await expect(xoqa).toHaveCount(0)

    // Hiding is remembered for this language across reloads, and can be undone.
    await page.getByRole("button", { name: "Hide validation warnings" }).click()
    const hidden = page.getByRole("button", { name: "2 warnings hidden — show" })
    await expect(hidden).toBeVisible()
    await expect(toggle).toHaveCount(0)
    await page.reload()
    await expect(hidden).toBeVisible()
    await hidden.click()
    await expect(toggle).toHaveText("2 Validation Warnings")

    // Swadesh coverage of this lexicon: water, fire, stone, name.
    const expected = matchSwadeshList(["stone", "water", "fire", "name"])
    await expect(swadeshCard(page).getByRole("heading", { name: /Swadesh List/ })).toContainText(
      `${expected.matched.size}/${SWADESH_LIST.length}`
    )
    expectNoPageErrors(pageErrors)
  })

  test("@overview a language with a clean lexicon shows no warnings card and zero coverage", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage({ entries: [{ lemma: "kala", gloss: "zzz-not-a-concept" }] })
    await page.goto(studioPath(language.slug))
    await expect(swadeshCard(page).getByRole("heading", { name: /Swadesh List/ })).toContainText(`0/${SWADESH_LIST.length}`)
    await expect(warningsToggle(page)).toHaveCount(0)
    await expect(page.getByRole("button", { name: /warnings? hidden/ })).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })
})

test.describe("studio tabs render for the owner", () => {
  // Every studio section of the public fixture: a heading, no client errors. (Includes the
  // dictionary toolbar + seeded entries and the courses page from the former studio.spec.ts.)
  const sections: { segment: string; heading: string | RegExp }[] = [
    { segment: "alphabet", heading: "Alphabet" },
    { segment: "phonology", heading: "Phonology" },
    { segment: "sound-changes", heading: "Sound Changes" },
    { segment: "grammar", heading: /Grammar/ },
    { segment: "dictionary", heading: "Dictionary" },
    { segment: "paradigms", heading: "Paradigm Tables" },
    { segment: "articles", heading: /Articles/ },
    { segment: "texts", heading: /Texts/ },
    { segment: "courses", heading: /Courses/ },
    { segment: "flashcards", heading: /Quick Practice/ },
    { segment: "translate", heading: /Translat/ },
    { segment: "modules", heading: /Modules/ },
    { segment: "settings", heading: "Settings" },
  ]

  for (const { segment, heading } of sections) {
    test(`${segment}`, async ({ page, pageErrors }) => {
      await page.goto(studioPath(E2E_LANGUAGES.public, segment))
      await expect(page.getByRole("main").getByRole("heading", { level: 1, name: heading })).toBeVisible()
      await expect(sidebar(page).getByRole("link", { name: "Overview", exact: true })).toBeVisible()
      if (segment === "dictionary") {
        await expect(page.getByPlaceholder("Search dictionary...")).toBeVisible()
        for (const lemma of E2E_CONTENT.entries) {
          await expect(page.getByRole("button", { name: lemma, exact: true })).toBeVisible()
        }
      }
      expectNoPageErrors(pageErrors)
    })
  }
})
