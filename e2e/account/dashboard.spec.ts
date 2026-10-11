import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { db, userId } from "../db"
import {
  cleanupScratch,
  createScratchUser,
  scratchLanguage,
  scratchLanguageOwnedBy,
  signInThroughForm,
  skipOnboardingTours,
} from "../access/helpers"

/**
 * The signed-in home: language cards, the stats row, and the dashboard sub-pages
 * (feed, families, modules, the site-translation picker).
 */

test.afterEach(cleanupScratch)

/** The stats pill whose label is `label` ("3 Languages"). */
function statPill(page: Page, label: string) {
  return page.locator("main").getByText(label, { exact: true }).locator("..")
}

test.describe("owner", () => {
  signedInAs("owner")

  test.beforeEach(async ({ page }) => {
    await skipOnboardingTours(page)
  })

  test("lists both fixture languages, linking to their studios", async ({ page, pageErrors }) => {
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { level: 1, name: "E2E" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 2, name: "Your Languages" })).toBeVisible()
    for (const [slug, name] of [
      ["e2e-public", "E2E Public Tongue"],
      ["e2e-private", "E2E Private Tongue"],
    ]) {
      const card = page.getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) })
      await expect(card).toHaveAttribute("href", `/studio/lang/${slug}`)
    }
    for (const label of ["Languages", "Script Symbols", "Grammar Pages", "Dictionary Entries"]) {
      await expect(statPill(page, label)).toHaveText(new RegExp(`^\\s*\\d+\\s*${label}\\s*$`))
    }
    await expect(page.getByRole("link", { name: "View feed →" })).toHaveAttribute("href", "/dashboard/feed")
    expectNoPageErrors(pageErrors)
  })

  test("a language card opens the studio", async ({ page, pageErrors }) => {
    await page.goto("/dashboard")
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "E2E Public Tongue", exact: true }) }).click()
    await page.waitForURL("**/studio/lang/e2e-public")
    await expect(page.getByRole("heading", { level: 1, name: "E2E Public Tongue" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  const SUBPAGES = [
    { path: "/dashboard/feed", heading: { level: 1, name: "Social Feed" } },
    { path: "/dashboard/families", heading: { level: 2, name: "Family Builder" } },
    { path: "/dashboard/families/manage", heading: { level: 1, name: "Manage Families" } },
    { path: "/dashboard/modules", heading: { level: 1, name: "My Modules" } },
    { path: "/dashboard/modules/new", heading: { level: 3, name: "Create a module" } },
    { path: "/dashboard/modules/playground", heading: { level: 1, name: "Module Playground" } },
    { path: "/dashboard/translate-ui", heading: { level: 1, name: "Translate the site" } },
  ] as const

  for (const subpage of SUBPAGES) {
    test(`${subpage.path} renders`, async ({ page, pageErrors }) => {
      await page.goto(subpage.path)
      await expect(page.getByRole("heading", { ...subpage.heading, exact: true })).toBeVisible()
      expectNoPageErrors(pageErrors)
    })
  }
})

test("stats count owned and shared languages exactly", async ({ page, pageErrors }) => {
  const user = await createScratchUser({ name: "Statsy Scratch" })
  const own = await scratchLanguageOwnedBy(user.id, { visibility: "PRIVATE" }) // 2 entries
  await db().scriptSymbol.createMany({
    data: ["a", "e", "i"].map((symbol, order) => ({ symbol, order, languageId: own.id })),
  })
  await db().grammarPage.create({
    data: { title: "Intro", slug: "intro", order: 0, languageId: own.id, content: { type: "doc", content: [] } },
  })
  // Shared with the user as a VIEWER: owned by the fixture owner, 11 symbols and 2 entries.
  const shared = await scratchLanguage("owner")
  await db().languageCollaborator.create({ data: { languageId: shared.id, userId: user.id, role: "VIEWER", permissions: [] } })

  await skipOnboardingTours(page)
  await signInThroughForm(page, user)
  await expect(page.getByRole("heading", { level: 1, name: "Statsy" })).toBeVisible()
  await expect(page.getByText("You have 2 languages")).toBeVisible()
  const expected = { Languages: 2, "Script Symbols": 14, "Grammar Pages": 1, "Dictionary Entries": 4 }
  for (const [label, value] of Object.entries(expected)) {
    await expect(statPill(page, label), label).toHaveText(new RegExp(`^\\s*${value}\\s*${label}\\s*$`))
  }
  await expect(page.getByRole("heading", { name: own.name, exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: shared.name, exact: true })).toBeVisible()
  // Another user's languages never appear.
  await expect(page.getByRole("heading", { name: "E2E Public Tongue", exact: true })).toHaveCount(0)
  expect(await userId("owner")).not.toBe(user.id)
  expectNoPageErrors(pageErrors)
})

test("signed out: the dashboard and its sub-pages redirect to /login", async ({ page }) => {
  for (const path of ["/dashboard", "/dashboard/feed", "/dashboard/modules/new", "/dashboard/translate-ui"]) {
    await page.goto(path)
    await page.waitForURL(/\/login/)
  }
})
