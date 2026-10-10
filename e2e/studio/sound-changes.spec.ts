import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { E2E_LANGUAGES } from "../data"
import { db } from "../db"
import { cleanupScratch, entryLemmas, scratchLanguage, setMetadata, studioPath, toast } from "./helpers"

signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))

function rulesBox(page: Page) {
  return page.getByPlaceholder(/Enter rules, one per line/)
}

function testWordsBox(page: Page) {
  return page.getByPlaceholder("Type words to test (comma-separated)...")
}

/** A Card located by its title. */
function card(page: Page, title: RegExp) {
  return page.locator("div.rounded-lg, div.rounded-xl").filter({ has: page.getByRole("heading", { name: title }) }).last()
}

/** "original → changed" result rows under the test-words input (each has an arrow icon). */
function testResults(page: Page) {
  return card(page, /Test Words/).locator("div.rounded-md", { has: page.locator("svg.lucide-arrow-right") })
}

/** Dictionary preview row for an entry, located by its gloss. */
function previewRow(page: Page, gloss: string) {
  return card(page, /Dictionary Preview/).getByRole("row").filter({ hasText: gloss })
}

function engineBadge(page: Page) {
  return page.locator('[title*="linguistics core"], [title*="JavaScript engine"]')
}

async function storedRules(languageId: string): Promise<unknown> {
  const language = await db().language.findUniqueOrThrow({ where: { id: languageId }, select: { metadata: true } })
  return (language.metadata as Record<string, unknown> | null)?.soundChangeRules
}

const FINAL_A = "// final a raises\na → e / _#"

test.describe("sound changes (owner)", () => {
  test("the editor loads the Go→WASM linguistics core", async ({ page, pageErrors }) => {
    // public/wasm/sound-change.wasm is built in this checkout; the badge starts "js" and flips.
    await page.goto(studioPath(E2E_LANGUAGES.public, "sound-changes"))
    await expect(engineBadge(page)).toBeVisible()
    await expect(engineBadge(page)).toHaveText("wasm", { timeout: 15_000 })
    await expect(engineBadge(page)).toHaveAttribute("title", "Powered by the Go→WASM linguistics core")
    expectNoPageErrors(pageErrors)
  })

  test("a rule previews on test words and the dictionary; applying waits for a save", async ({ page, pageErrors }) => {
    const language = await scratchLanguage({
      entries: [
        { lemma: "kala", gloss: "stone" },
        { lemma: "nemi", gloss: "name" },
        { lemma: "sata", gloss: "seven" },
      ],
    })
    await page.goto(studioPath(language.slug, "sound-changes"))
    await expect(engineBadge(page)).toHaveText("wasm", { timeout: 15_000 })
    await expect(page.getByText("Add rules on the left to see how they transform your dictionary.")).toBeVisible()

    await rulesBox(page).fill(FINAL_A)
    await expect(page.getByText("1 rule parsed")).toBeVisible()
    // "1." target, arrow icon, replacement, "/", environment
    await expect(card(page, /Parsed Rules/)).toContainText(/1\.\s*a\s*e\s*\/\s*_#/)

    // Test words
    await testWordsBox(page).fill("mana, tiki")
    await expect(testResults(page).filter({ hasText: /^mana/ })).toContainText("mane")
    await expect(testResults(page).filter({ hasText: /^mana/ })).toContainText("1 rule")
    await expect(testResults(page).filter({ hasText: /^tiki/ })).not.toContainText("rule")

    // Dictionary preview
    await expect(card(page, /Dictionary Preview/).getByText("2 changed")).toBeVisible()
    await expect(previewRow(page, "stone")).toContainText("kala")
    await expect(previewRow(page, "stone").getByRole("cell").nth(2)).toHaveText("kale")
    await expect(previewRow(page, "seven").getByRole("cell").nth(2)).toHaveText("sate")
    await expect(previewRow(page, "name").getByRole("cell").nth(2)).toHaveText("nemi")

    // Applying uses the saved rules: it is blocked until they are saved.
    const apply = page.getByRole("button", { name: "Apply to Dictionary (2 changes)" })
    await expect(apply).toBeDisabled()
    await expect(page.getByText("Save your rules to apply them.", { exact: false })).toBeVisible()
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(toast(page, "Sound change rules saved!")).toBeVisible()
    await expect.poll(() => storedRules(language.id)).toBe(FINAL_A)
    expect(await entryLemmas(language.id)).toEqual(["kala", "nemi", "sata"])

    // Saved rules come back with the page.
    await page.reload()
    await expect(rulesBox(page)).toHaveValue(FINAL_A)
    await expect(apply).toBeEnabled()
    expectNoPageErrors(pageErrors)
  })

  test("saved rules are applied to the dictionary after the review step", async ({ page, pageErrors }) => {
    const language = await scratchLanguage({
      entries: [
        { lemma: "kala", gloss: "stone" },
        { lemma: "nemi", gloss: "name" },
        { lemma: "sata", gloss: "seven" },
      ],
    })
    await setMetadata(language.id, { soundChangeRules: FINAL_A })
    await page.goto(studioPath(language.slug, "sound-changes"))
    await expect(engineBadge(page)).toHaveText("wasm", { timeout: 15_000 })
    await expect(rulesBox(page)).toHaveValue(FINAL_A)
    const apply = page.getByRole("button", { name: "Apply to Dictionary (2 changes)" })
    await expect(apply).toBeEnabled()

    // Review step: cancelling changes nothing.
    await apply.click()
    const review = page.getByRole("alertdialog", { name: "Apply Sound Changes" })
    await expect(review).toContainText("This will permanently update 2 entries")
    await expect(review).toContainText("This action cannot be undone.")
    await review.getByRole("button", { name: "Cancel" }).click()
    await expect(review).toBeHidden()
    expect(await entryLemmas(language.id)).toEqual(["kala", "nemi", "sata"])

    await apply.click()
    await review.getByRole("button", { name: "Apply Changes" }).click()
    await expect(toast(page, "Applied to dictionary: 2 entries updated, 1 unchanged")).toBeVisible()
    expect(await entryLemmas(language.id)).toEqual(["kale", "nemi", "sate"])

    // The editor re-reads the dictionary: nothing left to change.
    await expect(page.getByRole("button", { name: "Apply to Dictionary (0 changes)" })).toBeDisabled()
    await expect(previewRow(page, "stone").getByRole("cell").first()).toHaveText("kale")

    // The dictionary shows the new forms.
    await page.goto(studioPath(language.slug, "dictionary"))
    await expect(page.getByRole("button", { name: "kale", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "sate", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "kala", exact: true })).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("rules saved in the editor can be applied right away", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "sound-changes"))
    await rulesBox(page).fill(FINAL_A)
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(toast(page, "Sound change rules saved!")).toBeVisible()
    await page.getByRole("button", { name: "Apply to Dictionary (1 changes)" }).click()
    const review = page.getByRole("alertdialog", { name: "Apply Sound Changes" })
    await expect(review).toBeVisible()
    // Give a late refresh the chance to reset the editor before acting on the dialog.
    await page.waitForTimeout(2_000)
    await review.getByRole("button", { name: "Apply Changes" }).click()
    await expect(toast(page, "Applied to dictionary: 1 entry updated, 1 unchanged")).toBeVisible()
    expect(await entryLemmas(language.id)).toEqual(["kale", "nemi"])
    expectNoPageErrors(pageErrors)
  })

  test("saving rules keeps the test words being tried", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "sound-changes"))
    await rulesBox(page).fill("a → e / _#")
    await testWordsBox(page).fill("mana")
    await expect(testResults(page)).toContainText("mane")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(toast(page, "Sound change rules saved!")).toBeVisible()
    // The reset lands with the refresh that follows the toast; give it time to happen.
    await page.waitForTimeout(3_000)
    await expect(testWordsBox(page)).toHaveValue("mana")
    await expect(testResults(page)).toContainText("mane")
    expectNoPageErrors(pageErrors)
  })

  test("an adversarial rule (vowel classes sharing prefixes) previews and applies quickly", async ({
    page,
    pageErrors,
  }) => {
    // Vowels "a" and "aa" share a prefix: as a regex, an environment of 30 V's backtracks
    // exponentially on a long run of a's without the closing b.
    const rule = `t → d / _${"V".repeat(30)}b`
    const long = "t" + "a".repeat(52)
    const trigger = "t" + "a".repeat(60) + "b"
    const changed = "d" + "a".repeat(60) + "b"
    const language = await scratchLanguage({
      entries: [
        { lemma: long, gloss: "long" },
        { lemma: trigger, gloss: "trigger" },
      ],
    })
    await setMetadata(language.id, {
      soundChangeRules: rule,
      phonologyOverride: { enabled: true, vowels: ["a", "aa"], consonants: ["b", "t"] },
    })

    // The saved rule is previewed against the dictionary as the page loads.
    let started = Date.now()
    await page.goto(studioPath(language.slug, "sound-changes"))
    await expect(page.getByText("1 rule parsed")).toBeVisible({ timeout: 10_000 })
    await expect(card(page, /Dictionary Preview/).getByText("1 changed")).toBeVisible({ timeout: 10_000 })
    await expect(engineBadge(page)).toHaveText("wasm", { timeout: 15_000 })
    expect(Date.now() - started, "page with the preview loaded quickly").toBeLessThan(15_000)
    await expect(previewRow(page, "trigger").getByRole("cell").nth(2)).toHaveText(changed)
    await expect(previewRow(page, "long").getByRole("cell").nth(2)).toHaveText(long)

    // Typing adversarial test words stays responsive.
    started = Date.now()
    await testWordsBox(page).fill(`t${"a".repeat(200)}, ${trigger}`)
    await expect(testResults(page)).toHaveCount(2, { timeout: 5_000 })
    expect(Date.now() - started, "test words previewed quickly").toBeLessThan(5_000)
    await expect(testResults(page).nth(0)).not.toContainText("rule")
    await expect(testResults(page).nth(1)).toContainText(changed)

    // The server applies the same rule to every entry quickly.
    await page.getByRole("button", { name: "Apply to Dictionary (1 changes)" }).click()
    started = Date.now()
    await page.getByRole("alertdialog").getByRole("button", { name: "Apply Changes" }).click()
    await expect(toast(page, "Applied to dictionary: 1 entry updated, 1 unchanged")).toBeVisible({ timeout: 15_000 })
    expect(Date.now() - started, "server applied quickly").toBeLessThan(15_000)
    expect((await entryLemmas(language.id)).sort()).toEqual([changed, long].sort())
    expectNoPageErrors(pageErrors)
  })

  test("the preview matches what apply writes when vowel classes share prefixes", async ({ page, pageErrors }) => {
    // With vowels {a, aa}, "aaab" under a → e / _VVb: the first a is followed by V V (a, a) and b.
    // lib/utils/sound-change (the server's engine, equal to the old regex) gives "eaab"; the
    // WASM core tries "aa" for the first V, fails on b and gives "aaab".
    const language = await scratchLanguage({ entries: [{ lemma: "aaab", gloss: "short" }] })
    await setMetadata(language.id, {
      soundChangeRules: "a → e / _VVb",
      phonologyOverride: { enabled: true, vowels: ["a", "aa"], consonants: ["b"] },
    })
    await page.goto(studioPath(language.slug, "sound-changes"))
    await expect(engineBadge(page)).toHaveText("wasm", { timeout: 15_000 })
    await expect(previewRow(page, "short").getByRole("cell").nth(2)).toHaveText("eaab")

    await page.getByRole("button", { name: "Apply to Dictionary (1 changes)" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Apply Changes" }).click()
    await expect(toast(page, "Applied to dictionary: 1 entry updated, 0 unchanged")).toBeVisible()
    expect(await entryLemmas(language.id)).toEqual(["eaab"])
    expectNoPageErrors(pageErrors)
  })
})
