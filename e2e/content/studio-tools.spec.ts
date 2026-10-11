import type { Locator } from "@playwright/test"
import { test, expect, expectNoPageErrors, signedInAs, unique, type Page } from "../fixtures"
import { E2E_LANGUAGES } from "../data"
import { db, userId } from "../db"
import { cleanupScratchLanguages, ownerScratch, toast } from "./helpers"

/**
 * Studio tools around the content: the interface translation editor (/studio/lang/<slug>/translate)
 * and the modules pages (/studio/lang/<slug>/modules[/<moduleSlug>]).
 */
signedInAs("owner")
test.afterAll(cleanupScratchLanguages)

/** The editor's search input. (Its placeholder text is itself a translatable string, so a
 * translation field can carry the same placeholder.) */
function searchBox(page: Page): Locator {
  return page.locator('input[placeholder="Search strings..."]')
}

test.describe("studio translate", () => {
  test("translating an interface string saves it and counts it as translated", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PRIVATE")
    const id = unique()
    const key = "studio.grammar.pageTitle"

    await page.goto(`/studio/lang/${lang.slug}/translate`)
    await expect(page.getByRole("heading", { name: "Translation Editor" })).toBeVisible()
    const progress = page.getByText(/^\d+% \(\d+\/\d+\)$/)
    await expect(progress).toHaveText(/^0% \(0\/\d+\)$/)

    await searchBox(page).fill(key)
    await expect(page.getByText(key, { exact: true })).toBeVisible()
    // The translation field shows the English original as its placeholder.
    const field = page.getByPlaceholder("Grammar", { exact: true })
    await expect(field).toHaveCount(1)
    await field.fill(`Gramatika ${id}`)
    await expect(progress).toHaveText(/^\d+% \(1\/\d+\)$/)

    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(toast(page, /^Save$/)).toBeVisible()
    await expect
      .poll(async () => (await db().conlangTranslation.findFirst({ where: { languageId: lang.id, key } }))?.value)
      .toBe(`Gramatika ${id}`)

    await page.reload()
    await expect(progress).toHaveText(/^\d+% \(1\/\d+\)$/)
    await searchBox(page).fill(key)
    await expect(page.getByPlaceholder("Grammar", { exact: true })).toHaveValue(`Gramatika ${id}`)

    // "Untranslated" hides strings that already have a translation.
    await page.getByRole("button", { name: "Untranslated" }).click()
    await expect(page.getByText("No strings found matching your filters.")).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("a value with unbalanced placeholders is refused and nothing is stored", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PRIVATE")
    await page.goto(`/studio/lang/${lang.slug}/translate`)
    await searchBox(page).fill("studio.grammar.pageTitle")
    await page.getByPlaceholder("Grammar", { exact: true }).fill("Broken {placeholder")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(toast(page, "Error saving translations")).toBeVisible()
    expect(await db().conlangTranslation.count({ where: { languageId: lang.id } })).toBe(0)
    // The 422 is the app's validation answer, logged by the editor; nothing else may fail.
    expectNoPageErrors(pageErrors.filter((e) => !/status of 422|Failed to save/.test(e)))
  })
})

test.describe("studio modules", () => {
  test("the modules page renders for a language with nothing enabled", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${E2E_LANGUAGES.public}/modules`)
    await expect(page.getByRole("heading", { level: 1, name: "Modules" })).toBeVisible()
    await expect(page.getByText("How modules work on this language")).toBeVisible()
    await expect(page.getByRole("link", { name: "Browse catalog" }).first()).toHaveAttribute("href", "/modules")
    expectNoPageErrors(pageErrors)
  })

  test("an unknown module's panel shows the studio not-found page", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${E2E_LANGUAGES.public}/modules/no-such-module-${unique()}`)
    await expect(page.getByText("This page doesn't exist in this project")).toBeVisible()
    await expect(page.getByRole("link", { name: "Back to project overview" })).toHaveAttribute(
      "href",
      `/studio/lang/${E2E_LANGUAGES.public}`
    )
    expectNoPageErrors(pageErrors)
  })

  test("adding a theme module from its panel enables it for the language", async ({ page, pageErrors }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    // The E2E database has no catalog modules (prisma/seed-modules.ts is not part of the E2E
    // seed), so the test publishes a throwaway declarative theme and removes it afterwards.
    const mod = await db().module.create({
      data: {
        slug: `e2e-theme-${id}`,
        name: `E2E Theme ${id}`,
        type: "THEME",
        tier: "DECLARATIVE",
        status: "PUBLISHED",
        summary: "Throwaway theme for the studio modules E2E test.",
        authorId: await userId("viewer"),
        versions: {
          create: {
            version: "1.0.0",
            manifest: { id: `e2e-theme-${id}`, version: "1.0.0", type: "THEME", permissions: [] },
            permissions: [],
            data: { theme: { primary: "#b45309", accent: "#0e7490", background: "#faf6ee", radius: "0.5rem" } },
            publishedAt: new Date(),
          },
        },
      },
    })
    try {
      await page.goto(`/studio/lang/${lang.slug}/modules`)
      await expect(page.getByText("Enabled for this language (0)")).toBeVisible()
      await expect(page.getByText("No modules added yet")).toBeVisible()

      await page.goto(`/studio/lang/${lang.slug}/modules/${mod.slug}`)
      await expect(page.getByRole("heading", { level: 1, name: mod.name })).toBeVisible()
      await expect(page.getByText("Add this module to use it")).toBeVisible()
      await page.getByRole("button", { name: "Add to language" }).click()
      const dialog = page.getByRole("dialog", { name: "Add this module" })
      await expect(dialog).toContainText("This module requests no special permissions.")
      await dialog.getByRole("button", { name: "Add to this language" }).click()

      await expect(toast(page, `Added to ${lang.name}`)).toBeVisible()
      await expect(page.getByText("Palette")).toBeVisible()
      await expect(page.getByText("This theme is enabled")).toBeVisible()
      // Enabled modules get a studio sidebar entry.
      await expect(page.getByRole("complementary").getByRole("link", { name: mod.name })).toHaveAttribute(
        "href",
        `/studio/lang/${lang.slug}/modules/${mod.slug}`
      )

      await page.goto(`/studio/lang/${lang.slug}/modules`)
      await expect(page.getByText("Enabled for this language (1)")).toBeVisible()
      await page.getByRole("button", { name: "Remove from this language" }).click()
      await expect(toast(page, "Module removed")).toBeVisible()
      await expect(page.getByText("Enabled for this language (0)")).toBeVisible()
      expectNoPageErrors(pageErrors)
    } finally {
      await db().module.delete({ where: { id: mod.id } })
    }
  })
})
