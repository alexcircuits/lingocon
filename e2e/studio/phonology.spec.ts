import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { db } from "../db"
import { cleanupScratch, scratchLanguage, setSymbolIpaToSymbol, studioPath, toast } from "./helpers"

signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))

function consonantTable(page: Page) {
  return page.locator("table").filter({ has: page.getByRole("columnheader", { name: "Manner" }) })
}

function phoneme(page: Page, ipa: string) {
  return consonantTable(page).locator("span.group").filter({ has: page.getByText(ipa, { exact: true }) })
}

async function storedMetadata(languageId: string): Promise<Record<string, unknown>> {
  const language = await db().language.findUniqueOrThrow({ where: { id: languageId }, select: { metadata: true } })
  return (language.metadata ?? {}) as Record<string, unknown>
}

test.describe("phonology (owner)", () => {
  test("inventory and syllable structure edits persist across a reload", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await setSymbolIpaToSymbol(language.id)
    await page.goto(studioPath(language.slug, "phonology"))

    // Auto-detected from the alphabet's IPA values.
    await expect(page.getByText("6 consonants")).toBeVisible()
    await expect(page.getByText("5 vowels")).toBeVisible()
    await expect(page.getByText("11 total phonemes")).toBeVisible()
    await expect(phoneme(page, "k")).toBeVisible()

    await page.getByLabel("Syllable Template").fill("CV(C)")
    await page.getByLabel("Allophony & Sound Rules").fill("/t/ → [tʰ] / #_V")

    // Manual inventory: drop k, add p from the IPA keyboard.
    await page.getByRole("button", { name: "Edit Inventory" }).click()
    await expect(page.getByText("Manual override")).toBeVisible()
    await phoneme(page, "k").getByRole("button", { name: "Remove" }).click()
    await expect(phoneme(page, "k")).toHaveCount(0)
    await page.getByRole("button", { name: "Add Consonant" }).click()
    const composer = page.getByRole("dialog")
    await composer.getByRole("button", { name: "p", exact: true }).first().click()
    await composer.getByRole("button", { name: "Add", exact: true }).click()
    await expect(phoneme(page, "p")).toBeVisible()
    await page.getByRole("button", { name: "Done Editing" }).click()

    await page.getByRole("button", { name: "Save Phonology" }).click()
    await expect(toast(page, "Phonology settings saved")).toBeVisible()

    await page.reload()
    await expect(page.getByLabel("Syllable Template")).toHaveValue("CV(C)")
    await expect(page.getByLabel("Allophony & Sound Rules")).toHaveValue("/t/ → [tʰ] / #_V")
    await expect(page.getByText("Manual override")).toBeVisible()
    await expect(phoneme(page, "p")).toBeVisible()
    await expect(phoneme(page, "k")).toHaveCount(0)
    await expect(page.getByText("6 consonants")).toBeVisible()

    const metadata = await storedMetadata(language.id)
    expect(metadata.syllableStructure).toBe("CV(C)")
    expect(metadata.allophonyRules).toBe("/t/ → [tʰ] / #_V")
    expect(metadata.phonologyOverride).toMatchObject({ enabled: true })
    const override = metadata.phonologyOverride as { consonants: string[]; vowels: string[] }
    expect([...override.consonants].sort()).toEqual(["l", "m", "n", "p", "s", "t"])
    expect([...override.vowels].sort()).toEqual(["a", "e", "i", "o", "u"])

    // Back to the alphabet-derived inventory.
    await page.getByRole("button", { name: "Edit Inventory" }).click()
    await page.getByRole("button", { name: "Reset to Auto" }).click()
    await page.getByRole("button", { name: "Save Phonology" }).click()
    await expect(toast(page, "Phonology settings saved").last()).toBeVisible()
    await expect.poll(async () => (await storedMetadata(language.id)).phonologyOverride).toEqual({ enabled: false })
    await page.reload()
    await expect(page.getByText("Manual override")).toHaveCount(0)
    await expect(phoneme(page, "k")).toBeVisible()
    await expect(phoneme(page, "p")).toHaveCount(0)
    // Saving phonology keeps the syllable structure.
    await expect(page.getByLabel("Syllable Template")).toHaveValue("CV(C)")
    expectNoPageErrors(pageErrors)
  })

  test("saving phonology keeps sound-change rules saved elsewhere", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await db().language.update({
      where: { id: language.id },
      data: { metadata: { syllableStructure: "CV", soundChangeRules: "k → g / V_V" } },
    })
    await page.goto(studioPath(language.slug, "phonology"))
    await page.getByLabel("Syllable Template").fill("CVC")
    await page.getByRole("button", { name: "Save Phonology" }).click()
    await expect(toast(page, "Phonology settings saved")).toBeVisible()
    await expect.poll(async () => (await storedMetadata(language.id)).syllableStructure).toBe("CVC")
    expect((await storedMetadata(language.id)).soundChangeRules).toBe("k → g / V_V")
    expectNoPageErrors(pageErrors)
  })
})
