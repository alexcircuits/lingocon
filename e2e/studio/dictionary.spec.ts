import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { db } from "../db"
import {
  cleanupScratch,
  entryLemmas,
  scratchLanguage,
  setMetadata,
  setSymbolIpaToSymbol,
  studioPath,
  toast,
  watchDocumentLoads,
} from "./helpers"

signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))

/** The row of the desktop dictionary table whose lemma button is `lemma`. */
function entryRow(page: Page, lemma: string) {
  return page.getByRole("row").filter({ has: page.getByRole("button", { name: lemma, exact: true }) })
}

async function openAddDialog(page: Page) {
  await page.getByRole("main").getByRole("button", { name: "Add Entry", exact: true }).first().click()
  const dialog = page.getByRole("dialog", { name: "Add Dictionary Entry" })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe("dictionary (owner)", () => {
  test("a new entry appears in the table at once, without a page load, and survives a reload", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "dictionary"))
    await expect(entryRow(page, "kala")).toBeVisible()

    const loads = await watchDocumentLoads(page)
    const dialog = await openAddDialog(page)
    await dialog.locator("#lemma").fill("tomi")
    await dialog.locator("#gloss").fill("river")
    await dialog.getByRole("button", { name: "Add Entry" }).click()

    await expect(dialog).toBeHidden()
    await expect(entryRow(page, "tomi")).toBeVisible()
    await expect(entryRow(page, "tomi").getByRole("cell", { name: "river", exact: true })).toBeVisible()
    await expect(page.getByText("Showing 3 of 3 entries")).toBeVisible()
    // framenavigated does fire once here: Next's router replaceState()s the same URL after the
    // Server Action re-render. A same-document update, never a page load or a different URL.
    await loads.expectNoFullLoad(studioPath(language.slug, "dictionary"))
    expect(await entryLemmas(language.id)).toEqual(["kala", "nemi", "tomi"])

    await page.reload()
    await expect(entryRow(page, "tomi")).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("editing an entry shows the new gloss at once and after a reload", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "dictionary"))

    const loads = await watchDocumentLoads(page)
    await page.getByRole("button", { name: "Edit kala" }).click()
    const dialog = page.getByRole("dialog", { name: "Edit Dictionary Entry" })
    await expect(dialog.locator("#lemma")).toHaveValue("kala")
    await dialog.locator("#gloss").fill("pebble")
    await dialog.getByRole("button", { name: "Update Entry" }).click()

    await expect(dialog).toBeHidden()
    await expect(entryRow(page, "kala").getByRole("cell", { name: "pebble", exact: true })).toBeVisible()
    await expect(entryRow(page, "kala").getByRole("cell", { name: "stone", exact: true })).toHaveCount(0)
    await loads.expectNoFullLoad(studioPath(language.slug, "dictionary"))

    await page.reload()
    await expect(entryRow(page, "kala").getByRole("cell", { name: "pebble", exact: true })).toBeVisible()
    const stored = await db().dictionaryEntry.findFirstOrThrow({ where: { languageId: language.id, lemma: "kala" } })
    expect(stored.gloss).toBe("pebble")
    expectNoPageErrors(pageErrors)
  })

  test("deleting an entry removes it at once and after a reload", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "dictionary"))

    const loads = await watchDocumentLoads(page)
    await page.getByRole("button", { name: "Delete nemi" }).click()
    const confirm = page.getByRole("alertdialog")
    await expect(confirm).toContainText('This will permanently delete the dictionary entry "nemi"')
    await confirm.getByRole("button", { name: "Delete" }).click()

    await expect(confirm).toBeHidden()
    await expect(entryRow(page, "nemi")).toHaveCount(0)
    await expect(entryRow(page, "kala")).toBeVisible()
    await expect(page.getByText("Showing 1 of 1 entries")).toBeVisible()
    await loads.expectNoFullLoad(studioPath(language.slug, "dictionary"))

    await page.reload()
    await expect(entryRow(page, "kala")).toBeVisible()
    await expect(entryRow(page, "nemi")).toHaveCount(0)
    expect(await entryLemmas(language.id)).toEqual(["kala"])
    expectNoPageErrors(pageErrors)
  })

  test("search filters the list (all fields and by meaning) and the query is in the URL", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage({
      entries: [
        { lemma: "kala", gloss: "stone" },
        { lemma: "nemi", gloss: "name" },
        { lemma: "sule", gloss: "stone wall" },
      ],
    })
    await page.goto(studioPath(language.slug, "dictionary"))
    await expect(page.getByText("Showing 3 of 3 entries")).toBeVisible()

    const search = page.getByPlaceholder("Search dictionary...")
    await search.fill("nemi")
    await expect(page).toHaveURL(/[?&]q=nemi/)
    await expect(entryRow(page, "nemi")).toBeVisible()
    await expect(entryRow(page, "kala")).toHaveCount(0)
    await expect(page.getByText("Showing 1 of 1 entries")).toBeVisible()

    // Restrict to meanings: "stone" matches two glosses and no lemma. (The field picker shows its
    // "Field" placeholder until a field is chosen.)
    await page.getByRole("combobox").filter({ hasText: /^(Field|All Fields)$/ }).click()
    await page.getByRole("option", { name: "Meaning" }).click()
    await page.getByPlaceholder("Search meanings...").fill("stone")
    await expect(page).toHaveURL(/[?&]f=gloss/)
    await expect(entryRow(page, "kala")).toBeVisible()
    await expect(entryRow(page, "sule")).toBeVisible()
    await expect(entryRow(page, "nemi")).toHaveCount(0)

    // No match: an empty state that offers to add the word.
    await page.getByPlaceholder("Search meanings...").fill("zzz-nothing")
    await expect(page.getByText("No entries match your search.")).toBeVisible()
    await expect(page.getByRole("button", { name: 'Add "zzz-nothing"' })).toBeVisible()

    // The filtered view is linkable.
    await page.goto(`${studioPath(language.slug, "dictionary")}?q=stone&f=gloss`)
    await expect(entryRow(page, "sule")).toBeVisible()
    await expect(entryRow(page, "nemi")).toHaveCount(0)
    await expect(page.getByPlaceholder("Search meanings...")).toHaveValue("stone")
    expectNoPageErrors(pageErrors)
  })

  test("entry details: a full entry shows etymology, notes and tags when expanded", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "dictionary"))

    const dialog = await openAddDialog(page)
    await dialog.locator("#lemma").fill("silo")
    await dialog.locator("#gloss").fill("moon")
    await dialog.locator("#pos").fill("noun")
    await dialog.locator("#etymology").fill("from proto *sila")
    await dialog.locator("#notes").fill("Used in poetry.")
    await dialog.locator("#tags").fill("nature")
    await dialog.locator("#tags").press("Enter")
    await dialog.getByRole("button", { name: "Add Entry" }).click()
    await expect(dialog).toBeHidden()

    const row = entryRow(page, "silo")
    await expect(row.getByRole("cell", { name: "noun", exact: true })).toBeVisible()
    await row.getByRole("button", { name: "silo", exact: true }).click()
    const details = page.getByRole("row").filter({ hasText: "Used in poetry." })
    await expect(details).toBeVisible()
    await expect(details.getByRole("heading", { name: "Etymology" })).toBeVisible()
    await expect(details).toContainText("from proto *sila")
    await expect(details.getByRole("heading", { name: "Tags" })).toBeVisible()
    await expect(details).toContainText("nature")

    // Collapses again.
    await row.getByRole("button", { name: "silo", exact: true }).click()
    await expect(details).toHaveCount(0)

    const stored = await db().dictionaryEntry.findFirstOrThrow({ where: { languageId: language.id, lemma: "silo" } })
    expect(stored).toMatchObject({ gloss: "moon", partOfSpeech: "noun", etymology: "from proto *sila", notes: "Used in poetry." })
    expect(stored.tags).toEqual(["nature"])
    expectNoPageErrors(pageErrors)
  })

  test("word generator generates phonotactic candidates and hands one to the add dialog", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage()
    await setSymbolIpaToSymbol(language.id)
    await setMetadata(language.id, { syllableStructure: "CV" })
    await page.goto(studioPath(language.slug, "dictionary"))

    await page.getByRole("button", { name: "Generate Words" }).click()
    const generator = page.getByRole("dialog", { name: "Word Generator" })
    await expect(generator).toContainText("Structure: CV")
    await expect(generator).toContainText("6 consonants")
    await expect(generator).toContainText("5 vowels")
    await generator.getByRole("button", { name: "Generate 20 Words" }).click()

    const candidates = generator.locator("span.font-mono")
    await expect(candidates.first()).toBeVisible()
    const words = await candidates.allTextContents()
    expect(words.length).toBeGreaterThan(0)
    expect(words.length).toBeLessThanOrEqual(20)
    for (const word of words) {
      // Up to 3 CV syllables from this inventory; never an existing word.
      expect(word).toMatch(/^(?:[klmnst][aeiou]){1,3}$/)
      expect(["kala", "nemi"]).not.toContain(word)
    }

    await generator.getByRole("button", { name: "Add to dictionary" }).first().click()
    await expect(generator).toBeHidden()
    const add = page.getByRole("dialog", { name: "Add Dictionary Entry" })
    await expect(add.locator("#lemma")).toHaveValue(words[0])
    await add.getByRole("button", { name: "Cancel" }).click()
    await expect(add).toBeHidden()
    expect(await entryLemmas(language.id)).toEqual(["kala", "nemi"])
    expectNoPageErrors(pageErrors)
  })

  test("phonotactics: an adversarial lemma keeps the dialog responsive and is rejected quickly", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage()
    // The shape that made the old backtracking check take minutes on a ~37-letter word.
    await setMetadata(language.id, {
      syllableStructure: "(C)(C)V(C)(C)",
      consonants: ["k", "l", "m", "n", "s", "t"],
      vowels: ["a", "e", "i", "o", "u"],
    })
    await page.goto(studioPath(language.slug, "dictionary"))
    const dialog = await openAddDialog(page)

    // In the alphabet, but no valid syllabification (a final three-consonant cluster).
    const nearMiss = "tat".repeat(12) + "tt"
    let started = Date.now()
    await dialog.locator("#lemma").fill(nearMiss)
    await expect(dialog.getByText("Doesn't match your syllable structure:")).toBeVisible({ timeout: 5_000 })
    await dialog.locator("#gloss").fill("still typing")
    await expect(dialog.locator("#gloss")).toHaveValue("still typing")
    expect(Date.now() - started, "dialog stayed interactive").toBeLessThan(5_000)

    // The case from the report: a letter outside the inventory at the end.
    const adversarial = "tat".repeat(12) + "x"
    started = Date.now()
    await dialog.locator("#lemma").fill(adversarial)
    await expect(dialog.getByText("Contains characters not in your alphabet:")).toBeVisible({ timeout: 5_000 })
    await dialog.locator("#gloss").fill("adversarial")
    await expect(dialog.locator("#gloss")).toHaveValue("adversarial")
    expect(Date.now() - started, "dialog stayed interactive").toBeLessThan(5_000)

    // Saving runs the same check on the server: it must answer quickly (with a rejection).
    started = Date.now()
    await dialog.getByRole("button", { name: "Add Entry" }).click()
    await expect(toast(page, "does not match the language's syllable structure")).toBeVisible({ timeout: 10_000 })
    expect(Date.now() - started, "server answered the save quickly").toBeLessThan(10_000)
    await expect(dialog).toBeVisible()
    await expect(dialog.locator("#lemma")).toBeEditable()
    expect(await entryLemmas(language.id)).toEqual(["kala", "nemi"])

    // A valid word still saves.
    await dialog.locator("#lemma").fill("tatsat")
    await dialog.locator("#gloss").fill("valid")
    await dialog.getByRole("button", { name: "Add Entry" }).click()
    await expect(dialog).toBeHidden()
    await expect(entryRow(page, "tatsat")).toBeVisible()
    expectNoPageErrors(pageErrors.filter((e) => !/syllable structure/.test(e)))
  })
})

test.describe("dictionary find & replace", () => {
  test("is reachable from the desktop toolbar", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "dictionary"))
    await page.getByRole("button", { name: /find & replace/i }).click()
    await expect(page.getByRole("dialog", { name: "Find & replace" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test.describe("narrow viewport", () => {
    // The only place the dialog can be opened today (see the fixme above).
    test.use({ viewport: { width: 600, height: 900 } })

    test("regex find & replace previews the change and applies it", async ({ page, pageErrors }) => {
      const language = await scratchLanguage({
        entries: [
          { lemma: "kala", gloss: "stone" },
          { lemma: "kesu", gloss: "rain" },
          { lemma: "nemi", gloss: "name" },
        ],
      })
      await page.goto(studioPath(language.slug, "dictionary"))

      await page.getByRole("button", { name: "More actions" }).click()
      await page.getByRole("menuitem", { name: "Find & replace" }).click()
      const dialog = page.getByRole("dialog", { name: "Find & replace" })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole("button", { name: /^Apply/ })).toBeDisabled()

      // Backreference: ^k(.) → g$1
      await dialog.getByLabel("Find (regex)").fill("^k(.)")
      await dialog.getByLabel("Replace with").fill("g$1")
      await dialog.getByRole("button", { name: "Preview" }).click()
      await expect(dialog).toContainText("2 entries will change")
      await expect(dialog).toContainText("gala")
      await expect(dialog).toContainText("gesu")
      await expect(dialog).not.toContainText("nemi")
      // Preview writes nothing.
      expect(await entryLemmas(language.id)).toEqual(["kala", "kesu", "nemi"])

      // Editing the pattern invalidates the preview: it must be previewed again before applying.
      await dialog.getByLabel("Find (regex)").fill("^k(.)u")
      await expect(dialog.getByRole("button", { name: /^Apply/ })).toBeDisabled()
      await expect(dialog).not.toContainText("will change")
      await dialog.getByLabel("Find (regex)").fill("^k(.)")
      await dialog.getByRole("button", { name: "Preview" }).click()
      await expect(dialog).toContainText("2 entries will change")
      await dialog.getByRole("button", { name: "Apply to 2" }).click()

      await expect(dialog).toBeHidden()
      await expect(toast(page, "Updated 2 entries.")).toBeVisible()
      // Narrow viewports list entries as cards headed by the lemma.
      await expect(page.getByRole("heading", { name: "gala", exact: true })).toBeVisible()
      await expect(page.getByRole("heading", { name: "gesu", exact: true })).toBeVisible()
      await expect(page.getByRole("heading", { name: "kala", exact: true })).toHaveCount(0)
      expect(await entryLemmas(language.id)).toEqual(["gala", "gesu", "nemi"])
      expectNoPageErrors(pageErrors)
    })

    test("an invalid regex is reported and changes nothing", async ({ page, pageErrors }) => {
      const language = await scratchLanguage()
      await page.goto(studioPath(language.slug, "dictionary"))
      await page.getByRole("button", { name: "More actions" }).click()
      await page.getByRole("menuitem", { name: "Find & replace" }).click()
      const dialog = page.getByRole("dialog", { name: "Find & replace" })
      await dialog.getByLabel("Find (regex)").fill("(unclosed")
      await dialog.getByRole("button", { name: "Preview" }).click()
      await expect(page.locator("[data-sonner-toast][data-type='error']")).toBeVisible()
      await expect(dialog.getByRole("button", { name: /^Apply/ })).toBeDisabled()
      expect(await entryLemmas(language.id)).toEqual(["kala", "nemi"])
      expectNoPageErrors(pageErrors)
    })
  })
})
