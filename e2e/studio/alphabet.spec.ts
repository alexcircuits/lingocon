import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { db } from "../db"
import { cleanupScratch, openStudioTab, scratchLanguage, sidebarStat, studioPath, symbolOrder } from "./helpers"

signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))

/** Symbols in on-screen order, read from each card's "Actions for <symbol>" button. */
async function symbolsOnScreen(page: Page): Promise<string[]> {
  const labels = await page.getByRole("button", { name: /^Actions for / }).evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label") ?? "")
  )
  return labels.map((label) => label.replace(/^Actions for /, ""))
}

async function symbolAction(page: Page, symbol: string, action: "Edit" | "Move Left" | "Move Right" | "Delete") {
  await page.getByRole("button", { name: `Actions for ${symbol}`, exact: true }).click()
  await page.getByRole("menuitem", { name: action }).click()
}

const SCRATCH_ALPHABET = ["a", "e", "i", "o", "u", "k", "l", "m", "n", "s", "t"]

test.describe("alphabet (owner)", () => {
  test("add a symbol, move it, delete it — each persisted", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "alphabet"))
    await expect.poll(() => symbolsOnScreen(page)).toEqual(SCRATCH_ALPHABET)

    // Add
    await page.getByRole("main").getByRole("button", { name: "Add Symbol" }).click()
    const add = page.getByRole("dialog", { name: "Add Script Symbol" })
    await add.getByLabel("Lowercase").fill("z")
    await add.getByLabel("Uppercase (optional)").fill("Z")
    await add.getByLabel("Latin (optional)").fill("dz")
    await add.getByLabel("Name (optional)").fill("zeta")
    await add.getByRole("button", { name: "Add Symbol" }).click()
    await expect(add).toBeHidden()
    await expect.poll(() => symbolsOnScreen(page)).toEqual([...SCRATCH_ALPHABET, "z"])
    await expect(page.getByText("zeta", { exact: true })).toBeVisible()
    await expect(sidebarStat(page, "Symbols")).toHaveText("12")
    const added = await db().scriptSymbol.findFirstOrThrow({ where: { languageId: language.id, symbol: "z" } })
    expect(added).toMatchObject({ capitalSymbol: "Z", latin: "dz", name: "zeta" })

    // Reorder: z one place left, past t.
    await symbolAction(page, "z", "Move Left")
    await expect.poll(() => symbolsOnScreen(page)).toEqual([...SCRATCH_ALPHABET.slice(0, -1), "z", "t"])
    await expect.poll(() => symbolOrder(language.id)).toEqual([...SCRATCH_ALPHABET.slice(0, -1), "z", "t"])
    await page.reload()
    await expect.poll(() => symbolsOnScreen(page)).toEqual([...SCRATCH_ALPHABET.slice(0, -1), "z", "t"])

    // Move the first symbol right.
    await symbolAction(page, "a", "Move Right")
    await expect.poll(() => symbolOrder(language.id)).toEqual(["e", "a", "i", "o", "u", "k", "l", "m", "n", "s", "z", "t"])

    // Delete (confirmed)
    await symbolAction(page, "z", "Delete")
    const confirm = page.getByRole("alertdialog", { name: "Delete “z”?" })
    await expect(confirm).toBeVisible()
    await confirm.getByRole("button", { name: "Delete" }).click()
    await expect(page.getByRole("button", { name: "Actions for z", exact: true })).toHaveCount(0)
    await expect(sidebarStat(page, "Symbols")).toHaveText("11")
    await page.reload()
    await expect.poll(() => symbolsOnScreen(page)).toEqual(["e", "a", "i", "o", "u", "k", "l", "m", "n", "s", "t"])
    expect(await db().scriptSymbol.count({ where: { languageId: language.id, symbol: "z" } })).toBe(0)
    expectNoPageErrors(pageErrors)
  })

  test("editing a symbol updates its card", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "alphabet"))
    await symbolAction(page, "k", "Edit")
    const edit = page.getByRole("dialog", { name: "Edit Script Symbol" })
    await expect(edit.getByLabel("Lowercase")).toHaveValue("k")
    await edit.getByLabel("Name (optional)").fill("kappa")
    await edit.getByRole("button", { name: "Update Symbol" }).click()
    await expect(edit).toBeHidden()
    await expect(page.getByText("kappa", { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText("kappa", { exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("cancelling the delete confirmation keeps the symbol", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "alphabet"))
    await symbolAction(page, "m", "Delete")
    const confirm = page.getByRole("alertdialog", { name: "Delete “m”?" })
    await confirm.getByRole("button", { name: "Cancel" }).click()
    await expect(confirm).toBeHidden()
    await expect(page.getByRole("button", { name: "Actions for m", exact: true })).toBeVisible()
    expect(await symbolOrder(language.id)).toEqual(SCRATCH_ALPHABET)
    expectNoPageErrors(pageErrors)
  })

  test("@overview removing a symbol a word uses produces a validation warning on the overview", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug))
    await expect(page.getByRole("heading", { level: 1, name: language.name })).toBeVisible()
    await expect(page.getByRole("button", { name: /Validation Warning/ })).toHaveCount(0)

    await openStudioTab(page, "Alphabet")
    await expect(page).toHaveURL(new RegExp(`${studioPath(language.slug, "alphabet")}$`))
    await symbolAction(page, "k", "Delete")
    await page.getByRole("alertdialog", { name: "Delete “k”?" }).getByRole("button", { name: "Delete" }).click()
    await expect(page.getByRole("button", { name: "Actions for k", exact: true })).toHaveCount(0)

    // Back to the overview in-app: "kala" now uses a letter outside the alphabet.
    await openStudioTab(page, "Overview")
    const toggle = page.getByRole("button", { name: "1 Validation Warning" })
    await expect(toggle).toBeVisible()
    await toggle.click()
    await expect(page.getByText('• Entry "kala" uses undefined symbols: k')).toBeVisible()

    // An entry using a letter that was never in the alphabet is flagged too.
    await db().dictionaryEntry.create({ data: { languageId: language.id, lemma: "vemi", gloss: "rope" } })
    await page.reload()
    await expect(page.getByRole("button", { name: "2 Validation Warnings" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})
