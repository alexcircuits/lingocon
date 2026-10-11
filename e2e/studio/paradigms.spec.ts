import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { db } from "../db"
import { cleanupScratch, scratchLanguage, sidebarStat, studioPath, toast } from "./helpers"

signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))

/** The card of a paradigm, located by its title. */
function paradigmCard(page: Page, name: string) {
  return page
    .locator("div.rounded-lg, div.rounded-xl")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .filter({ has: page.getByRole("table") })
    .last()
}

/** The text of every body cell, row by row (row label first). */
async function paradigmCells(page: Page, name: string): Promise<string[][]> {
  return paradigmCard(page, name)
    .locator("tbody tr")
    .evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll("td")).map((td) => td.textContent?.trim() ?? "")))
}

async function storedParadigm(languageId: string, name: string) {
  const paradigm = await db().paradigm.findFirstOrThrow({ where: { languageId, name } })
  return paradigm.slots as { rows: string[]; columns: string[]; cells: Record<string, string> }
}

test.describe("paradigms (owner)", () => {
  test("create a paradigm, fill its cells, change its structure — persisted", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "paradigms"))
    await expect(page.getByText("No paradigm tables yet")).toBeVisible()

    // The toolbar trigger (the empty state repeats the label; see the fixme below).
    await page.locator('button[aria-haspopup="dialog"]', { hasText: "Add Paradigm" }).click()
    const create = page.getByRole("dialog", { name: "Create Paradigm Table" })
    await create.getByLabel("Name *").fill("First Declension")
    await create.getByLabel("Row Labels *").fill("Singular\nPlural")
    await create.getByLabel("Column Labels *").fill("Nominative\nGenitive")
    await create.getByLabel("Notes (optional)").fill("Regular nouns.")
    await create.getByRole("button", { name: "Create Paradigm" }).click()
    await expect(create).toBeHidden()

    const card = paradigmCard(page, "First Declension")
    await expect(card).toBeVisible()
    await expect(card).toContainText("Regular nouns.")
    await expect(card.getByRole("columnheader", { name: "Nominative" })).toBeVisible()
    await expect(card.getByRole("columnheader", { name: "Genitive" })).toBeVisible()
    await expect.poll(() => paradigmCells(page, "First Declension")).toEqual([
      ["Singular", "-", "-"],
      ["Plural", "-", "-"],
    ])
    await expect(sidebarStat(page, "Paradigms")).toHaveText("1")

    // Fill the cells.
    await card.getByRole("button", { name: "Edit Content" }).click()
    const content = page.getByRole("dialog", { name: "Edit Paradigm Content: First Declension" })
    const inputs = content.getByRole("textbox")
    await expect(inputs).toHaveCount(4)
    await inputs.nth(0).fill("kala")
    await inputs.nth(1).fill("kalas")
    await inputs.nth(2).fill("kalai")
    await inputs.nth(3).fill("kalais")
    await content.getByRole("button", { name: "Save Changes" }).click()
    await expect(content).toBeHidden()
    await expect(toast(page, "Paradigm content updated successfully")).toBeVisible()
    await expect.poll(() => paradigmCells(page, "First Declension")).toEqual([
      ["Singular", "kala", "kalas"],
      ["Plural", "kalai", "kalais"],
    ])

    await page.reload()
    await expect.poll(() => paradigmCells(page, "First Declension")).toEqual([
      ["Singular", "kala", "kalas"],
      ["Plural", "kalai", "kalais"],
    ])
    expect((await storedParadigm(language.id, "First Declension")).cells).toEqual({
      "0-0": "kala",
      "0-1": "kalas",
      "1-0": "kalai",
      "1-1": "kalais",
    })

    // Add a column: existing forms stay where they were.
    await paradigmCard(page, "First Declension").getByRole("button", { name: "Edit Structure" }).click()
    const structure = page.getByRole("dialog", { name: "Edit Paradigm Table" })
    await structure.getByLabel("Column Labels *").fill("Nominative\nGenitive\nDative")
    await structure.getByRole("button", { name: "Update Paradigm" }).click()
    await expect(structure).toBeHidden()
    await expect.poll(() => paradigmCells(page, "First Declension")).toEqual([
      ["Singular", "kala", "kalas", "-"],
      ["Plural", "kalai", "kalais", "-"],
    ])
    expect((await storedParadigm(language.id, "First Declension")).columns).toEqual(["Nominative", "Genitive", "Dative"])
    expectNoPageErrors(pageErrors)
  })

  test("the empty state's Add Paradigm button opens the create dialog", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "paradigms"))
    await expect(page.getByText("No paradigm tables yet")).toBeVisible()
    // The empty state's call to action comes after the toolbar trigger.
    await page.getByRole("main").getByText("Add Paradigm", { exact: true }).last().click()
    await expect(page.getByRole("dialog", { name: "Create Paradigm Table" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("a paradigm can be attached to a dictionary entry and deleted", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await db().paradigm.create({
      data: {
        languageId: language.id,
        name: "Verb class A",
        slots: { rows: ["1sg", "2sg"], columns: ["present"], cells: { "0-0": "-a", "1-0": "-e" } },
      },
    })

    // Attach from the entry dialog.
    await page.goto(studioPath(language.slug, "dictionary"))
    await page.getByRole("button", { name: "Edit kala" }).click()
    const dialog = page.getByRole("dialog", { name: "Edit Dictionary Entry" })
    const select = dialog.getByLabel("Inflection paradigm")
    await expect(select.locator("option", { hasText: "Verb class A" })).toHaveCount(1)
    await select.selectOption({ label: "Verb class A" })
    await dialog.getByRole("button", { name: "Update Entry" }).click()
    await expect(dialog).toBeHidden()
    const paradigm = await db().paradigm.findFirstOrThrow({ where: { languageId: language.id, name: "Verb class A" } })
    await expect
      .poll(async () => (await db().dictionaryEntry.findFirstOrThrow({ where: { languageId: language.id, lemma: "kala" } })).paradigmId)
      .toBe(paradigm.id)

    // The dialog shows the attachment when reopened after a reload.
    await page.reload()
    await page.getByRole("button", { name: "Edit kala" }).click()
    await expect(dialog.getByLabel("Inflection paradigm")).toHaveValue(paradigm.id)
    await dialog.getByRole("button", { name: "Cancel" }).click()

    // Deleting the paradigm detaches it from the entry.
    await page.goto(studioPath(language.slug, "paradigms"))
    await paradigmCard(page, "Verb class A").getByRole("button", { name: "Delete paradigm" }).click()
    const confirm = page.getByRole("alertdialog")
    await confirm.getByRole("button", { name: "Delete" }).click()
    await expect(page.getByRole("heading", { name: "Verb class A", exact: true })).toHaveCount(0)
    await expect(page.getByText("No paradigm tables yet")).toBeVisible()
    const entry = await db().dictionaryEntry.findFirstOrThrow({ where: { languageId: language.id, lemma: "kala" } })
    expect(entry.paradigmId).toBeNull()
    expectNoPageErrors(pageErrors)
  })
})
