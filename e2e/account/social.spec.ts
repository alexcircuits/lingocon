import { test, expect, expectNoPageErrors, signedInAs, unique, type Page } from "../fixtures"
import { authFile } from "../data"
import { db, userId } from "../db"
import { cleanupScratch, createScratchUser, scratchLanguage } from "../access/helpers"

/**
 * Social features: favorites, follows and the notification bell — including that a
 * user's notifications reach only that user. Targets are scratch languages/users so
 * counts on the shared fixtures never move.
 */

test.afterEach(cleanupScratch)

/**
 * The signed-in navbar overflows at the default 1280px (see "the bell is reachable at
 * 1280px"); bell interactions run wider so they test the bell, not that layout bug.
 */
const WIDE = { width: 1600, height: 900 }

/** The language hero's favorite toggle (a heart icon and the count; it has no accessible name). */
function favoriteButton(page: Page) {
  return page.getByRole("button").filter({ has: page.locator("svg.lucide-heart") }).first()
}

async function openBell(page: Page) {
  await page.getByRole("button", { name: "Notifications" }).click()
  const panel = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Notifications" }) })
  await expect(panel).toBeVisible()
  await expect(panel.getByText("Loading...")).toHaveCount(0)
  return panel
}

test.describe("stranger", () => {
  signedInAs("stranger")

  test("favorites a public language: it is listed in /favorites and the owner is notified", async ({
    page,
    browser,
    pageErrors,
  }) => {
    const language = await scratchLanguage("owner", { visibility: "PUBLIC" })
    const strangerId = await userId("stranger")

    await page.goto(`/lang/${language.slug}`)
    await expect(page.getByRole("heading", { level: 1, name: language.name })).toBeVisible()
    await expect(favoriteButton(page)).toHaveText("0")
    await favoriteButton(page).click()
    await expect(page.getByText("Added to favorites")).toBeVisible()
    await expect(favoriteButton(page)).toHaveText("1")
    expect(await db().favorite.count({ where: { userId: strangerId, languageId: language.id } })).toBe(1)

    await page.goto("/favorites")
    await expect(page.getByRole("heading", { level: 1, name: "Favorites" })).toBeVisible()
    await expect(page.getByText(language.name).first()).toBeVisible()

    // The owner's bell, in the owner's own session.
    const ownerContext = await browser.newContext({ storageState: authFile("owner"), viewport: WIDE })
    try {
      const ownerPage = await ownerContext.newPage()
      await ownerPage.goto("/browse")
      const panel = await openBell(ownerPage)
      await expect(panel.getByText(`E2E Stranger favorited ${language.name}`)).toBeVisible()
    } finally {
      await ownerContext.close()
    }

    // Toggling again removes it.
    await page.goto(`/lang/${language.slug}`)
    await favoriteButton(page).click()
    await expect(page.getByText("Removed from favorites")).toBeVisible()
    await page.goto("/favorites")
    await expect(page.getByText(language.name)).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("follows a user from their profile and can unfollow", async ({ page, pageErrors }) => {
    const target = await createScratchUser({ name: "Followable Scratch" })
    const strangerId = await userId("stranger")

    await page.goto(`/users/${target.id}`)
    await expect(page.getByRole("heading", { name: "Followable Scratch" }).first()).toBeVisible()
    const follow = page.getByRole("button", { name: "Follow", exact: true })
    await follow.click()
    await expect(page.getByText("Now following this user")).toBeVisible()
    await expect(page.getByRole("button", { name: "Unfollow", exact: true })).toHaveText("Following")
    expect(await db().follow.count({ where: { followerId: strangerId, followingId: target.id } })).toBe(1)
    expect(await db().notification.count({ where: { userId: target.id, type: "NEW_FOLLOWER" } })).toBe(1)

    await page.reload()
    await page.getByRole("button", { name: "Unfollow", exact: true }).click()
    await expect(page.getByText("Unfollowed this user")).toBeVisible()
    await expect(page.getByRole("button", { name: "Follow", exact: true })).toBeVisible()
    expect(await db().follow.count({ where: { followerId: strangerId, followingId: target.id } })).toBe(0)
    expectNoPageErrors(pageErrors)
  })

  test("own profile offers no follow button", async ({ page, pageErrors }) => {
    await page.goto(`/users/${await userId("stranger")}`)
    await expect(page.getByRole("heading", { name: "E2E Stranger" }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Follow", exact: true })).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })
})

test("the bell shows a notification to its recipient only", async ({ browser }) => {
  const actorName = `Probe ${unique()}`
  const notification = await db().notification.create({
    data: { userId: await userId("owner"), type: "NEW_FOLLOWER", data: { actorName } },
    select: { id: true },
  })
  try {
    for (const role of ["owner", "stranger"] as const) {
      const context = await browser.newContext({ storageState: authFile(role), viewport: WIDE })
      try {
        const page = await context.newPage()
        const api = await (await page.request.get("/api/me/notifications")).json()
        const ids = (api.notifications as { id: string }[]).map((n) => n.id)
        await page.goto("/browse")
        const panel = await openBell(page)
        if (role === "owner") {
          expect(ids).toContain(notification.id)
          await expect(panel.getByText(`${actorName} followed you`)).toBeVisible()
        } else {
          expect(ids).not.toContain(notification.id)
          await expect(panel.getByText(`${actorName} followed you`)).toHaveCount(0)
        }
      } finally {
        await context.close()
      }
    }
  } finally {
    await db().notification.deleteMany({ where: { id: notification.id } })
  }
})

test.describe("signed-in navbar at 1280px", () => {
  signedInAs("owner")

  test("the bell and account menu are reachable", async ({ page, pageErrors }) => {
    await page.goto("/dashboard/feed")
    await expect(page.getByRole("button", { name: "Notifications" })).toBeInViewport()
    await expect(page.getByRole("button", { name: "Toggle theme" })).toBeInViewport()
    await page.getByRole("button", { name: "Notifications" }).click()
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Notifications" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })
})

test("signed out: /favorites redirects to /login and the bell is empty", async ({ page }) => {
  const api = await (await page.request.get("/api/me/notifications")).json()
  expect(api).toMatchObject({ notifications: [], unreadCount: 0 })
  await page.goto("/favorites")
  await page.waitForURL(/\/login/)
})

test("/contributions renders", async ({ page, pageErrors }) => {
  await page.goto("/contributions")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("We need your help")
  expectNoPageErrors(pageErrors)
})
