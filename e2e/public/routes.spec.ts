import { test, expect, expectNoPageErrors, unique } from "../fixtures"
import { E2E_CONTENT, E2E_LANGUAGES } from "../data"
import { db, userId } from "../db"
import { EN, expectNotFoundPage } from "./helpers"

/**
 * Every public route renders for a signed-out visitor: 200, its key content, and no
 * client-side errors (hydration/render errors that a 200 SSR response would hide).
 */
test.describe("public routes (signed out)", () => {
  // `navbar: false` — the page renders its own minimal header instead of the site navbar.
  const H1_ROUTES: { path: string; heading: string | RegExp; navbar?: false }[] = [
    { path: "/browse", heading: "Browse" },
    { path: "/docs", heading: "Developer documentation" },
    { path: "/modules", heading: "Modules" },
    { path: "/modules/docs", heading: "Building Modules", navbar: false },
    { path: "/contact", heading: EN.contact.headline },
    { path: "/learn/browse", heading: "Learn a language" },
    { path: "/login", heading: EN.auth.signInTitle },
    { path: "/register", heading: EN.auth.registerTitle },
    { path: "/forgot-password", heading: EN.auth.forgotTitle },
  ]

  for (const { path, heading, navbar } of H1_ROUTES) {
    test(`${path} renders`, async ({ page, pageErrors }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible()
      if (navbar !== false) {
        await expect(page.locator("header").getByRole("link", { name: EN.common.signIn })).toBeVisible()
      }
      expectNoPageErrors(pageErrors)
    })
  }

  test("landing page has a hero and calls to action", async ({ page, pageErrors }) => {
    const response = await page.goto("/")
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/LingoCon/)
    await expect(page.getByRole("heading", { level: 1, name: /Invent a language/ })).toBeVisible()
    await expect(page.getByRole("link", { name: /start building/i }).first()).toHaveAttribute("href", "/login")
    await expect(page.getByRole("link", { name: /explore/i }).first()).toHaveAttribute("href", "/browse")
    await expect(page.locator("footer")).toContainText("LingoCon")
    expectNoPageErrors(pageErrors)
  })

  test("browse lists public languages but never private ones", async ({ page, pageErrors }) => {
    await page.goto("/browse")
    await expect(page.getByRole("textbox", { name: /filter languages/i })).toBeVisible()
    await expect(page.locator('a[href^="/lang/"]').first()).toBeVisible()
    // Both fixture languages are called "E2E … Tongue"; browse is paginated, so filter by name.
    await page.goto("/browse?q=Tongue")
    await expect(page.locator(`a[href="/lang/${E2E_LANGUAGES.public}"]`).first()).toBeVisible()
    await expect(page.locator(`a[href="/lang/${E2E_LANGUAGES.private}"]`)).toHaveCount(0)
    await expect(page.getByText("E2E Private Tongue")).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("search finds public dictionary entries and nothing from private languages", async ({ page, pageErrors }) => {
    await page.goto("/search?q=tama")
    await expect(page.getByRole("textbox", { name: /search lingocon/i })).toHaveValue("tama")
    const hit = page.getByRole("link", { name: /tama/ }).filter({ has: page.getByRole("heading") })
    await expect(hit.first()).toBeVisible()
    await expect(page.getByText(`E2E Public Tongue: ${E2E_CONTENT.glosses.tama}`)).toBeVisible()
    // e2e-private has the very same "tama" entry: it must not leak into results.
    await expect(page.getByText(/E2E Private Tongue/)).toHaveCount(0)
    await expect(page.locator(`a[href*="/lang/${E2E_LANGUAGES.private}"]`)).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("search API excludes private languages, entries and articles", async ({ request }) => {
    for (const q of ["tama", "Tongue", "Welcome"]) {
      const res = await request.get(`/api/search?q=${encodeURIComponent(q)}&scope=all`)
      expect(res.ok()).toBe(true)
      const body = JSON.stringify(await res.json())
      expect(body, `query ${q}`).toContain(`"slug":"${E2E_LANGUAGES.public}"`)
      expect(body, `query ${q}`).not.toContain(E2E_LANGUAGES.private)
      expect(body, `query ${q}`).not.toContain("E2E Private Tongue")
    }
  })

  test("/search without a query renders the search box", async ({ page, pageErrors }) => {
    const response = await page.goto("/search")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("textbox", { name: /search constructed languages/i })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("a docs page renders its markdown", async ({ page, pageErrors }) => {
    const response = await page.goto("/docs/architecture")
    expect(response?.status()).toBe(200)
    const article = page.getByRole("article")
    await expect(article.getByRole("heading", { level: 1, name: "Architecture" })).toBeVisible()
    await expect(article).toContainText("Next.js")
    await expect(page.getByRole("complementary").getByRole("link", { name: "Database" })).toHaveAttribute(
      "href",
      "/docs/database"
    )
    expectNoPageErrors(pageErrors)
  })

  test("an unknown docs page is not found", async ({ page }) => {
    await page.goto("/docs/no-such-guide")
    await expect(page.getByText(EN.errors.pageNotFound, { exact: true })).toBeVisible()
  })

  test("/families renders the family map", async ({ page, pageErrors }) => {
    const response = await page.goto("/families")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: "The Constructed Universe" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("/donate renders its appeal", async ({ page, pageErrors }) => {
    const response = await page.goto("/donate")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1, name: /Help us keep LingoCon free/ })).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("a user profile shows public languages only", async ({ page, pageErrors }) => {
    const response = await page.goto(`/users/${await userId("owner")}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1, name: "E2E Owner" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "E2E Public Tongue" })).toBeVisible()
    await expect(page.getByText("E2E Private Tongue")).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("an unknown user profile is not found", async ({ page }) => {
    await page.goto("/users/no-such-user-id")
    await expectNotFoundPage(page)
  })

  test("login, register and reset forms render their fields", async ({ page, pageErrors }) => {
    await page.goto("/login")
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("link", { name: EN.auth.forgotPassword })).toHaveAttribute("href", "/forgot-password")

    await page.goto("/register")
    await expect(page.getByLabel("Name")).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: EN.auth.createAccountButton })).toBeVisible()

    // Without a token the reset page explains the link is invalid instead of showing a form.
    await page.goto("/reset-password")
    await expect(page.getByText(EN.auth.invalidResetLink)).toBeVisible()
    await expect(page.getByRole("link", { name: EN.auth.requestNewLink })).toHaveAttribute("href", "/forgot-password")
    expectNoPageErrors(pageErrors)
  })

  test("an unknown path is a 404 with the not-found page", async ({ page }) => {
    const response = await page.goto(`/no-such-page-${unique()}`)
    expect(response?.status()).toBe(404)
    await expect(page.getByText(EN.errors.pageNotFound, { exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: EN.errors.returnToHome })).toHaveAttribute("href", "/")
  })

  test("an unknown language is not found", async ({ page }) => {
    await page.goto("/lang/does-not-exist")
    await expectNotFoundPage(page)
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0)
  })
})

test.describe("module marketplace pages", () => {
  // Scratch modules (owned by `stranger`) exist only for the duration of each test.
  async function createModule(status: "PUBLISHED" | "DRAFT") {
    const suffix = unique()
    return db().module.create({
      data: {
        slug: `e2e-module-${suffix}`,
        name: `E2E Module ${suffix}`,
        summary: "A scratch theme module for E2E.",
        type: "THEME",
        tier: "DECLARATIVE",
        status,
        authorId: await userId("stranger"),
      },
      select: { id: true, slug: true, name: true },
    })
  }

  test("a published module has a detail page", async ({ page, pageErrors }) => {
    const mod = await createModule("PUBLISHED")
    try {
      const response = await page.goto(`/modules/${mod.slug}`)
      expect(response?.status()).toBe(200)
      await expect(page.getByRole("heading", { name: mod.name }).first()).toBeVisible()
      await expect(page.getByText("A scratch theme module for E2E.").first()).toBeVisible()
      expectNoPageErrors(pageErrors)
    } finally {
      await db().module.delete({ where: { id: mod.id } })
    }
  })

  test("a draft module is not found for visitors", async ({ page }) => {
    const mod = await createModule("DRAFT")
    try {
      await page.goto(`/modules/${mod.slug}`)
      await expect(page.getByText(EN.errors.pageNotFound, { exact: true })).toBeVisible()
      await expect(page.getByText(mod.name)).toHaveCount(0)
    } finally {
      await db().module.delete({ where: { id: mod.id } })
    }
  })
})
