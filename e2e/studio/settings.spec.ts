import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { authFile, E2E_LANGUAGES, E2E_USERS } from "../data"
import { db, userId } from "../db"
import {
  cleanupLater,
  cleanupScratch,
  dashboardCard,
  entryLemmas,
  openStudioTab,
  scratchLanguage,
  sidebar,
  skipOnboardingTours,
  studioPath,
  toast,
} from "./helpers"
import type { ScratchLanguage } from "../db"

signedInAs("owner")
test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))

/**
 * Open a scratch language's studio the way a user does: from the dashboard, then in-app.
 * (Every studio request, in-app ones included, makes the middleware cache "no reservation"
 * for the slug for a minute — see the fixme'd rename test.)
 */
async function openStudioInApp(page: Page, language: ScratchLanguage): Promise<void> {
  await skipOnboardingTours(page.context())
  await page.goto("/dashboard")
  await dashboardCard(page, language).click()
  await expect(page).toHaveURL(new RegExp(`${studioPath(language.slug)}$`))
  await expect(page.getByRole("heading", { level: 1, name: language.name })).toBeVisible()
}

/** What renaming in settings does to the data: new slug, old one reserved for 180 days. */
async function renameInDatabase(language: ScratchLanguage, newSlug: string): Promise<void> {
  await db().$transaction([
    db().language.update({ where: { id: language.id }, data: { slug: newSlug, lastSlugChangedAt: new Date() } }),
    db().slugReservation.create({
      data: { slug: language.slug, languageId: language.id, reservedUntil: new Date(Date.now() + 180 * 86_400_000) },
    }),
  ])
}

function notFound(page: Page) {
  return page.getByText("Page not found", { exact: true })
}

async function saveSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Save Changes" }).click()
  await expect(toast(page, "Settings updated successfully")).toBeVisible()
}

async function setVisibility(page: Page, visibility: "Public" | "Private" | "Unlisted"): Promise<void> {
  await page.locator("#visibility").click()
  await page.getByRole("option", { name: visibility, exact: true }).click()
  await saveSettings(page)
}

test.describe("language settings (owner)", () => {
  test("rename name and slug: the studio follows, a full load of an old URL reaches the renamed project", async ({
    page,
    pageErrors,
  }) => {
    const language = await scratchLanguage()
    const newSlug = `${language.slug}-renamed`
    const newName = `${language.name} Renamed`
    cleanupLater(newSlug)

    await openStudioInApp(page, language)
    await openStudioTab(page, "Settings")
    await expect(page.locator("#slug")).toHaveValue(language.slug)
    await page.locator("#name").fill(newName)
    await page.locator("#slug").fill(newSlug)
    await saveSettings(page)

    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug, "settings")}$`))
    await expect(sidebar(page).getByRole("heading", { name: newName })).toBeVisible()
    await expect(page.locator("#slug")).toHaveValue(newSlug)
    const stored = await db().language.findUniqueOrThrow({ where: { id: language.id } })
    expect(stored).toMatchObject({ slug: newSlug, name: newName })
    const reservation = await db().slugReservation.findUniqueOrThrow({ where: { slug: language.slug } })
    expect(reservation.languageId).toBe(language.id)

    // In-app, the renamed project's sections work under the new slug.
    await openStudioTab(page, "Dictionary")
    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug, "dictionary")}$`))
    await expect(page.getByRole("button", { name: "kala", exact: true })).toBeVisible()

    // Full page load of an old URL. Known issue: right after a rename it lands on the overview,
    // not the same section (see "…right after renaming in the studio keeps the section").
    await page.goto(studioPath(language.slug, "dictionary"))
    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug)}(/dictionary)?$`))
    await expect(sidebar(page).getByRole("heading", { name: newName })).toBeVisible()
    await expect(notFound(page)).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("a full page load of an old URL keeps the section (studio and public pages)", async ({
    page,
    browser,
    pageErrors,
  }) => {
    // Renamed behind the studio's back: no request has touched the old slug, so the middleware
    // looks the reservation up (the path a bookmark or an external link takes).
    const language = await scratchLanguage({ visibility: "PUBLIC" })
    const newSlug = `${language.slug}-moved`
    cleanupLater(newSlug)
    await renameInDatabase(language, newSlug)

    await page.goto(studioPath(language.slug, "dictionary"))
    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug, "dictionary")}$`))
    await expect(page.getByRole("button", { name: "kala", exact: true })).toBeVisible()

    const visitorContext = await browser.newContext()
    const visitor = await visitorContext.newPage()
    await visitor.goto(`/lang/${language.slug}/dictionary`)
    await expect(visitor).toHaveURL(new RegExp(`/lang/${newSlug}/dictionary$`))
    await expect(visitor.getByRole("button", { name: "Show details for kala" })).toBeVisible()
    await visitorContext.close()
    expectNoPageErrors(pageErrors)
  })

  test("in-app navigation from a dashboard opened before the rename reaches the renamed project", async ({
    page,
    context,
    pageErrors,
  }) => {
    const language = await scratchLanguage()
    const newSlug = `${language.slug}-moved`
    cleanupLater(newSlug)
    await skipOnboardingTours(context)
    await page.goto("/dashboard")
    const card = dashboardCard(page, language)
    await expect(card).toBeVisible()
    await renameInDatabase(language, newSlug)

    // Known issue: lands on the overview, whatever the link's section (layout fallback redirect).
    await card.click()
    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug)}$`))
    await expect(page.getByRole("heading", { level: 1, name: language.name })).toBeVisible()
    await expect(notFound(page)).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("in-app navigation in a studio tab opened before the rename reaches the renamed project", async ({ page }) => {
    const language = await scratchLanguage()
    const newSlug = `${language.slug}-moved`
    cleanupLater(newSlug)
    await openStudioInApp(page, language)
    await renameInDatabase(language, newSlug)
    await openStudioTab(page, "Dictionary")
    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug)}(/dictionary)?$`))
    await expect(notFound(page)).toHaveCount(0)
  })

  test("in-app navigation to an old slug keeps the section", async ({ page }) => {
    const language = await scratchLanguage()
    const newSlug = `${language.slug}-moved`
    cleanupLater(newSlug)
    await openStudioInApp(page, language)
    await renameInDatabase(language, newSlug)
    await openStudioTab(page, "Dictionary")
    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug, "dictionary")}$`))
    await expect(page.getByRole("button", { name: "kala", exact: true })).toBeVisible()
  })

  test("a full page load of an old URL right after renaming in the studio keeps the section", async ({ page }) => {
    const language = await scratchLanguage()
    const newSlug = `${language.slug}-renamed`
    cleanupLater(newSlug)
    await openStudioInApp(page, language)
    await openStudioTab(page, "Settings")
    await page.locator("#slug").fill(newSlug)
    await saveSettings(page)
    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug, "settings")}$`))

    await page.goto(studioPath(language.slug, "dictionary"))
    await expect(page).toHaveURL(new RegExp(`${studioPath(newSlug, "dictionary")}$`))
  })

  test("a slug that is already taken is rejected with a message", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "settings"))
    await page.locator("#slug").fill(E2E_LANGUAGES.public)
    await page.getByRole("button", { name: "Save Changes" }).click()
    await expect(toast(page, "A language with this slug already exists")).toBeVisible()
    await expect(page.getByRole("main").getByText("A language with this slug already exists")).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${studioPath(language.slug, "settings")}$`))
    const stored = await db().language.findUniqueOrThrow({ where: { id: language.id } })
    expect(stored.slug).toBe(language.slug)
    expectNoPageErrors(pageErrors.filter((e) => !/already exists/.test(e)))
  })

  test("visibility PUBLIC ↔ PRIVATE is reflected on the public page for signed-out visitors", async ({
    page,
    browser,
    pageErrors,
  }) => {
    const language = await scratchLanguage({ visibility: "PRIVATE" })
    const visitorContext = await browser.newContext()
    const visitor = await visitorContext.newPage()
    const publicUrl = `/lang/${language.slug}`

    await visitor.goto(publicUrl)
    await expect(notFound(visitor)).toBeVisible()

    await page.goto(studioPath(language.slug, "settings"))
    await setVisibility(page, "Public")
    expect((await db().language.findUniqueOrThrow({ where: { id: language.id } })).visibility).toBe("PUBLIC")

    await visitor.goto(publicUrl)
    await expect(visitor.getByRole("heading", { name: language.name }).first()).toBeVisible()
    await expect(notFound(visitor)).toHaveCount(0)
    await visitor.goto(`${publicUrl}/dictionary`)
    await expect(visitor.getByRole("button", { name: "Show details for kala" })).toBeVisible()

    await page.reload()
    await setVisibility(page, "Private")
    expect((await db().language.findUniqueOrThrow({ where: { id: language.id } })).visibility).toBe("PRIVATE")

    await visitor.goto(publicUrl)
    await expect(notFound(visitor)).toBeVisible()
    await visitor.goto(`${publicUrl}/dictionary`)
    await expect(notFound(visitor)).toBeVisible()
    await visitorContext.close()
    expectNoPageErrors(pageErrors)
  })

  test("collaborators: a viewer gets read-only studio access until removed", async ({ page, browser, pageErrors }) => {
    const language = await scratchLanguage({ visibility: "PRIVATE" })
    const strangerContext = await browser.newContext({ storageState: authFile("stranger") })
    const stranger = await strangerContext.newPage()

    await stranger.goto(studioPath(language.slug))
    await expect(notFound(stranger)).toBeVisible()

    // Invite by email (an exact email match, never a partial one).
    await page.goto(studioPath(language.slug, "settings"))
    await expect(page.getByText("No collaborators yet")).toBeVisible()
    await page.getByRole("combobox").filter({ hasText: "Search by display name..." }).click()
    await page.getByPlaceholder("Search by display name...").fill(E2E_USERS.stranger.email)
    await page.getByRole("option", { name: new RegExp(E2E_USERS.stranger.name) }).click()
    await expect(page.getByRole("button", { name: "Invite Collaborator" })).toBeEnabled()
    await page.getByRole("button", { name: "Invite Collaborator" }).click()
    await expect(toast(page, "Collaborator invited")).toBeVisible()
    const row = page.getByRole("row").filter({ hasText: E2E_USERS.stranger.name })
    await expect(row).toBeVisible()
    await expect(row.getByText("Viewer", { exact: true })).toBeVisible()
    const strangerId = await userId("stranger")
    const collaborator = await db().languageCollaborator.findUniqueOrThrow({
      where: { languageId_userId: { languageId: language.id, userId: strangerId } },
    })
    expect(collaborator.permissions).toEqual([])

    // The viewer can open the studio and read, but not change anything.
    await stranger.goto(studioPath(language.slug))
    await expect(stranger.getByRole("heading", { level: 1, name: language.name })).toBeVisible()
    await stranger.goto(studioPath(language.slug, "dictionary"))
    await expect(stranger.getByRole("button", { name: "kala", exact: true })).toBeVisible()
    await expect(stranger.getByText(/^View only/)).toBeVisible()
    await expect(stranger.getByRole("main").getByRole("button", { name: "Add Entry", exact: true })).toHaveCount(0)
    expect(await entryLemmas(language.id)).toEqual(["kala", "nemi"])
    await stranger.goto(studioPath(language.slug, "settings"))
    await expect(stranger.getByText("Only the language owner can manage collaborators")).toBeVisible()
    await expect(stranger.locator("#slug")).toBeDisabled()
    await expect(stranger.getByRole("button", { name: "Delete Language" })).toHaveCount(0)

    // Remove (confirmed in a native dialog).
    page.once("dialog", (confirm) => void confirm.accept())
    await row.getByRole("button", { name: "Remove collaborator" }).click()
    await expect(toast(page, "Collaborator removed")).toBeVisible()
    await expect(page.getByText("No collaborators yet")).toBeVisible()
    expect(await db().languageCollaborator.count({ where: { languageId: language.id } })).toBe(0)

    await stranger.goto(studioPath(language.slug))
    await expect(notFound(stranger)).toBeVisible()
    await strangerContext.close()
    expectNoPageErrors(pageErrors)
  })

  test("delete language: gone from the dashboard and the studio", async ({ page, pageErrors }) => {
    const language = await scratchLanguage()
    await page.goto(studioPath(language.slug, "settings"))
    await page.getByRole("button", { name: "Delete Language" }).click()
    const dialog = page.getByRole("dialog", { name: "Delete Language" })
    const confirm = dialog.getByRole("button", { name: "Delete Language" })
    await expect(confirm).toBeDisabled()
    await dialog.getByPlaceholder(language.name).fill(`${language.name} typo`)
    await expect(confirm).toBeDisabled()
    await dialog.getByPlaceholder(language.name).fill(language.name)
    await confirm.click()

    await expect(toast(page, "Language deleted successfully")).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.locator(`a[href="${studioPath(language.slug)}"]`)).toHaveCount(0)
    expect(await db().language.count({ where: { id: language.id } })).toBe(0)

    // A real 404 (not a not-found page streamed into a 200): no loading boundary wraps the
    // studio layout that looks the language up.
    expect((await page.goto(studioPath(language.slug)))?.status()).toBe(404)
    await expect(notFound(page)).toBeVisible()
    expect((await page.goto(studioPath(language.slug, "dictionary")))?.status()).toBe(404)
    await expect(notFound(page)).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})
