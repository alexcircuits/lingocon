import { dismissCookieNotice, test, expect, expectNoPageErrors, signedInAs, unique, type Page } from "../fixtures"
import { authFile } from "../data"
import { db, userId } from "../db"
import {
  cleanupScratch,
  createScratchUser,
  expectLoginPage,
  interceptServerAction,
  publicLanguageId,
  replayServerAction,
  scratchLanguageOwnedBy,
  signInThroughForm,
  swap,
} from "../access/helpers"

/**
 * The admin panel (requireAdmin in app/admin/layout.tsx: non-admins are sent to
 * /dashboard) and its user suspension flow, which must cut off the suspended user's
 * existing session and leave an audit trail. Admin Server Actions are also replayed
 * from a non-admin session.
 */

const ADMIN_PAGES = [
  { path: "/admin", heading: "Admin Dashboard" },
  { path: "/admin/analytics", heading: "Analytics" },
  { path: "/admin/audit", heading: "Audit Logs" },
  { path: "/admin/content", heading: "Content" },
  { path: "/admin/languages", heading: "Languages" },
  { path: "/admin/modules", heading: "Modules" },
  { path: "/admin/surveys", heading: "Survey Results" },
  { path: "/admin/system", heading: "System" },
  { path: "/admin/traffic", heading: "Traffic" },
  { path: "/admin/users", heading: "Users" },
] as const

test.afterEach(cleanupScratch)

/** Admin's user page → Suspend (with a reason) or Unsuspend, waiting for the new state. */
async function setSuspended(page: Page, targetId: string, suspend: boolean, reason = "") {
  await page.goto(`/admin/users/${targetId}`)
  if (suspend) {
    await page.getByRole("button", { name: "Suspend User", exact: true }).click()
    const dialog = page.getByRole("alertdialog")
    await dialog.locator("#reason").fill(reason)
    await dialog.getByRole("button", { name: "Suspend User", exact: true }).click()
    await expect(page.getByText("User is suspended")).toBeVisible()
  } else {
    await page.getByRole("button", { name: "Unsuspend User", exact: true }).click()
    await expect(page.getByRole("button", { name: "Suspend User", exact: true })).toBeVisible()
  }
}

test.describe("admin", () => {
  signedInAs("admin")

  for (const adminPage of ADMIN_PAGES) {
    test(`${adminPage.path} renders`, async ({ page, pageErrors }) => {
      await page.goto(adminPage.path)
      await expect(page.getByRole("heading", { level: 1, name: adminPage.heading, exact: true })).toBeVisible()
      expectNoPageErrors(pageErrors)
    })
  }

  test("a guest's visit shows up on the Traffic page, counted anonymously", async ({ page, browser, baseURL, pageErrors }) => {
    // A visitor of its own: a unique browser and address (nginx sets X-Real-IP in production),
    // so the rest of the suite neither shares its visitor key nor its rate-limit bucket.
    const marker = `e2e-traffic-${unique()}`
    const visitorContext = await browser.newContext({
      baseURL,
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 ${marker}`,
      extraHTTPHeaders: { "x-real-ip": `198.51.100.${Math.floor(Math.random() * 250) + 1}` },
    })
    await dismissCookieNotice(visitorContext)
    // Page views are stored with the hour only.
    const recent = { createdAt: { gte: new Date(Date.now() - 2 * 3_600_000) } }
    const viewsBefore = await db().statsPageView.count({ where: { path: "/families", ...recent } })
    try {
      const visitor = await visitorContext.newPage()
      const beacon = visitor.waitForRequest((request) => request.url().endsWith("/api/stats") && request.method() === "POST")
      await visitor.goto("/families?from=e2e-secret-query")
      const sent = await beacon
      expect(JSON.parse(sent.postData() ?? "{}")).toMatchObject({ type: "pageview", path: "/families" })
      expect(sent.postData()).not.toContain("e2e-secret-query")

      await expect.poll(async () => db().statsPageView.count({ where: { path: "/families", ...recent } })).toBeGreaterThan(viewsBefore)

      await page.goto("/admin/traffic")
      await expect(page.getByRole("heading", { level: 1, name: "Traffic", exact: true })).toBeVisible()
      const pagesOpen = page.getByRole("list", { name: "Pages open right now" })
      await expect(pagesOpen.getByText("/families", { exact: true })).toBeVisible()
      expect(Number(await page.getByTestId("live-online").textContent())).toBeGreaterThan(0)

      // Nothing that identifies the visitor reached the database.
      const stored = JSON.stringify([
        await db().statsPageView.findMany({ where: recent }),
        await db().statsPresence.findMany(),
      ])
      expect(stored).not.toContain(marker)
      expect(stored).not.toContain("198.51.100.")
      expect(stored).not.toContain("e2e-secret-query")
    } finally {
      await visitorContext.close()
    }
    expectNoPageErrors(pageErrors)
  })

  test("language detail renders for a fixture language", async ({ page, pageErrors }) => {
    await page.goto(`/admin/languages/${await publicLanguageId()}`)
    await expect(page.getByRole("heading", { level: 1, name: "E2E Public Tongue" })).toBeVisible()
    await expect(page.getByText("/e2e-public", { exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("user detail renders for a fixture user", async ({ page, pageErrors }) => {
    await page.goto(`/admin/users/${await userId("stranger")}`)
    await expect(page.getByRole("heading", { level: 1, name: "E2E Stranger" })).toBeVisible()
    await expect(page.getByText("stranger@e2e.test").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Suspend User", exact: true })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("suspending a user ends their session's access; unsuspending restores it; both are audited", async ({
    page,
    browser,
    pageErrors,
  }) => {
    const target = await createScratchUser()
    const language = await scratchLanguageOwnedBy(target.id, { visibility: "PRIVATE" })
    const reason = `E2E suspension ${unique()}`

    const userContext = await browser.newContext()
    await dismissCookieNotice(userContext)
    try {
      const userPage = await userContext.newPage()
      await signInThroughForm(userPage, target)
      const studio = `/studio/lang/${language.slug}`
      await userPage.goto(studio)
      await expect(userPage.getByRole("heading", { level: 1, name: language.name })).toBeVisible()

      await setSuspended(page, target.id, true, reason)
      expect(await db().user.findUniqueOrThrow({ where: { id: target.id }, select: { isSuspended: true } })).toEqual({
        isSuspended: true,
      })
      await expect(page.getByText(`Reason: ${reason}`)).toBeVisible()

      // The same browser session, still holding its JWT, is now treated as signed out.
      await userPage.goto(studio)
      await expectLoginPage(userPage)
      expect((await userPage.request.get("/api/ext/tokens")).status()).toBe(401)

      await setSuspended(page, target.id, false)
      expect(await db().user.findUniqueOrThrow({ where: { id: target.id }, select: { isSuspended: true } })).toEqual({
        isSuspended: false,
      })
      await userPage.goto(studio)
      await expect(userPage.getByRole("heading", { level: 1, name: language.name })).toBeVisible()
      expect((await userPage.request.get("/api/ext/tokens")).status()).toBe(200)
    } finally {
      await userContext.close()
    }

    for (const action of ["SUSPEND_USER", "UNSUSPEND_USER"]) {
      await page.goto(`/admin/audit?action=${action}`)
      const row = page.getByRole("row").filter({ hasText: target.email })
      await expect(row).toHaveCount(1)
      await expect(row).toContainText(action)
      await expect(row).toContainText("admin@e2e.test")
      await expect(row).toContainText(target.id.slice(0, 8))
    }
    expect(await db().auditLog.count({ where: { resourceId: target.id } })).toBe(2)
    expectNoPageErrors(pageErrors)
  })

  test("a suspension action replayed from non-admin sessions is rejected", async ({ page, browser }) => {
    const first = await createScratchUser()
    const second = await createScratchUser()
    // Capture the real action on one scratch user, then put it back.
    await page.goto(`/admin/users/${first.id}`)
    await page.getByRole("button", { name: "Suspend User", exact: true }).click()
    const dialog = page.getByRole("alertdialog")
    const { captured } = await interceptServerAction(page, () => dialog.getByRole("button", { name: "Suspend User", exact: true }).click(), {
      match: (body) => body.includes(first.id),
    })
    await expect(page.getByText("User is suspended")).toBeVisible()

    for (const role of ["stranger", "owner"] as const) {
      const context = await browser.newContext({ storageState: authFile(role) })
      try {
        const replay = await replayServerAction(context, captured, swap(captured.body, first.id, second.id))
        // requireAdmin() answers with a redirect to /dashboard instead of running the action.
        expect(replay.status, `${role} replay status`).toBeLessThan(500)
      } finally {
        await context.close()
      }
    }
    const after = await db().user.findUniqueOrThrow({ where: { id: second.id }, select: { isSuspended: true } })
    expect(after.isSuspended).toBe(false)
    expect(await db().auditLog.count({ where: { resourceId: second.id } })).toBe(0)

    // Control: the same replay from the admin's own session does run, so the refusals
    // above come from authorization, not from a malformed request.
    await replayServerAction(page.context(), captured, swap(captured.body, first.id, second.id))
    await expect
      .poll(async () => (await db().user.findUniqueOrThrow({ where: { id: second.id }, select: { isSuspended: true } })).isSuspended)
      .toBe(true)
  })
})

test.describe("stranger (not an admin)", () => {
  signedInAs("stranger")

  for (const adminPage of ADMIN_PAGES) {
    test(`${adminPage.path} redirects to the dashboard`, async ({ page, pageErrors }) => {
      await page.goto(adminPage.path)
      await page.waitForURL("**/dashboard")
      await expect(page.getByRole("heading", { level: 1, name: adminPage.heading, exact: true })).toHaveCount(0)
      expectNoPageErrors(pageErrors)
    })
  }

  test("admin detail pages and the user export redirect or refuse", async ({ page, pageErrors }) => {
    await page.goto(`/admin/users/${await userId("owner")}`)
    await page.waitForURL("**/dashboard")
    await page.goto(`/admin/languages/${await publicLanguageId()}`)
    await page.waitForURL("**/dashboard")
    const exported = await page.request.get("/api/admin/export/users", { maxRedirects: 0 })
    expect(exported.status()).toBe(403)
    expect(await exported.text()).not.toContain("owner@e2e.test")
    const live = await page.request.get("/api/admin/stats/live", { maxRedirects: 0 })
    expect(live.status()).toBe(403)
    expect(await live.json()).toEqual({ error: "Forbidden" })
    expectNoPageErrors(pageErrors)
  })
})

test("signed out: /admin redirects to sign-in", async ({ page }) => {
  await page.goto("/admin/users")
  await page.waitForURL(/\/login/)
})
