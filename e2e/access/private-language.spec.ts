import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { E2E_LANGUAGES } from "../data"
import { userId } from "../db"
import { expectLoginPage, expectNotFound } from "./helpers"

/**
 * Who may open the studio and the public reader of the PRIVATE fixture `e2e-private`
 * (owner = owner, editor = legacy EDITOR with full write, viewer = VIEWER).
 *
 *  - studio layout: signed out → /login; otherwise `canViewLanguage` (owner, any
 *    collaborator, admin; PUBLIC to everyone) or the site 404.
 *  - public reader: PRIVATE projects have no public page (404 for everyone, owner included).
 *  - settings: delete, transfer and collaborator management are owner-only; the slug
 *    field is owner-only; other fields need write:settings.
 */

const SLUG = E2E_LANGUAGES.private
const NAME = "E2E Private Tongue"
const STUDIO_PAGES = [
  { name: "overview", path: "", heading: NAME },
  { name: "dictionary", path: "/dictionary", heading: "Dictionary" },
  { name: "grammar", path: "/grammar", heading: "Grammar" },
  { name: "settings", path: "/settings", heading: "Settings" },
] as const

const studioUrl = (path: string) => `/studio/lang/${SLUG}${path}`

async function expectStudioPage(page: Page, heading: string): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible()
  // Inside the studio shell (its sidebar), not a bare error page.
  await expect(sidebarTab(page, "Overview")).toBeVisible()
}

/** Desktop sidebar link of a studio tab (the mobile bottom bar repeats some of them). */
function sidebarTab(page: Page, name: string) {
  return page.locator("aside").getByRole("link", { name, exact: true })
}

async function openSettings(page: Page): Promise<void> {
  await page.goto(studioUrl("/settings"))
  await expectStudioPage(page, "Settings")
  await expect(page.locator("#name")).toHaveValue(NAME)
}

test.describe("signed out", () => {
  for (const studio of STUDIO_PAGES) {
    test(`studio ${studio.name} redirects to /login`, async ({ page, pageErrors }) => {
      await page.goto(studioUrl(studio.path))
      await expectLoginPage(page)
      expectNoPageErrors(pageErrors)
    })
  }

  test("public reader is not found", async ({ page, pageErrors }) => {
    for (const path of ["", "/dictionary", "/grammar/introduction"]) {
      await page.goto(`/lang/${SLUG}${path}`)
      await expectNotFound(page)
      await expect(page.getByText(NAME)).toHaveCount(0)
    }
    expectNoPageErrors(pageErrors)
  })
})

test.describe("stranger", () => {
  signedInAs("stranger")

  for (const studio of STUDIO_PAGES) {
    test(`studio ${studio.name} is not found`, async ({ page, pageErrors }) => {
      await page.goto(studioUrl(studio.path))
      await expectNotFound(page)
      await expect(page.getByText(NAME)).toHaveCount(0)
      // Nothing of the language's content is rendered either.
      await expect(page.getByText("tama", { exact: true })).toHaveCount(0)
      expectNoPageErrors(pageErrors)
    })
  }

  test("public reader is not found", async ({ page, pageErrors }) => {
    for (const path of ["", "/dictionary", "/grammar/introduction"]) {
      await page.goto(`/lang/${SLUG}${path}`)
      await expectNotFound(page)
      await expect(page.getByText(NAME)).toHaveCount(0)
    }
    expectNoPageErrors(pageErrors)
  })

  test("the owner's profile lists the public language but not the private one", async ({ page, pageErrors }) => {
    await page.goto(`/users/${await userId("owner")}`)
    await expect(page.getByText("E2E Public Tongue").first()).toBeVisible()
    await expect(page.getByText(NAME)).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })
})

test.describe("viewer (VIEWER collaborator)", () => {
  signedInAs("viewer")

  for (const studio of STUDIO_PAGES) {
    test(`can open studio ${studio.name}`, async ({ page, pageErrors }) => {
      await page.goto(studioUrl(studio.path))
      await expectStudioPage(page, studio.heading)
      expectNoPageErrors(pageErrors)
    })
  }

  test("sees the dictionary read-only: content shown, write tabs locked", async ({ page, pageErrors }) => {
    await page.goto(studioUrl("/dictionary"))
    await expectStudioPage(page, "Dictionary")
    await expect(page.getByRole("cell", { name: "tama", exact: true }).filter({ visible: true })).toBeVisible()
    for (const tab of ["Dictionary", "Grammar", "Alphabet", "Paradigms"]) {
      await expect(sidebarTab(page, tab).locator("svg.lucide-lock"), `${tab} tab locked`).toBeVisible()
    }
    expectNoPageErrors(pageErrors)
  })

  test("edit controls are hidden or disabled in the studio", async ({ page, pageErrors }) => {
    await page.goto(studioUrl("/dictionary"))
    await expectStudioPage(page, "Dictionary")
    await expect(page.getByRole("button", { name: "Add Entry" }).filter({ visible: true }).and(page.locator(":enabled"))).toHaveCount(0)
    await page.goto(studioUrl("/grammar"))
    await expectStudioPage(page, "Grammar")
    await expect(page.getByRole("link", { name: "New Page" })).toHaveCount(0)
    await openSettings(page)
    await expect(page.getByRole("button", { name: "Save Changes" }).and(page.locator(":enabled"))).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("settings offer no owner controls", async ({ page, pageErrors }) => {
    await openSettings(page)
    await expect(page.getByText("Only the language owner can manage collaborators", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Invite Collaborator" })).toHaveCount(0)
    await expect(page.getByText("Danger Zone")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Delete Language" })).toHaveCount(0)
    await expect(page.locator("#slug")).toBeDisabled()
    expectNoPageErrors(pageErrors)
  })

  test("public reader is not found", async ({ page, pageErrors }) => {
    await page.goto(`/lang/${SLUG}`)
    await expectNotFound(page)
    expectNoPageErrors(pageErrors)
  })
})

test.describe("editor (legacy EDITOR, full write)", () => {
  signedInAs("editor")

  for (const studio of STUDIO_PAGES) {
    test(`can open studio ${studio.name}`, async ({ page, pageErrors }) => {
      await page.goto(studioUrl(studio.path))
      await expectStudioPage(page, studio.heading)
      expectNoPageErrors(pageErrors)
    })
  }

  test("has unlocked write tabs and an enabled Add Entry", async ({ page, pageErrors }) => {
    await page.goto(studioUrl("/dictionary"))
    await expectStudioPage(page, "Dictionary")
    for (const tab of ["Dictionary", "Grammar", "Alphabet"]) {
      await expect(sidebarTab(page, tab)).toBeVisible()
      await expect(sidebarTab(page, tab).locator("svg.lucide-lock"), `${tab} tab unlocked`).toHaveCount(0)
    }
    await expect(page.getByRole("button", { name: "Add Entry" }).first()).toBeEnabled()
    expectNoPageErrors(pageErrors)
  })

  test("settings: no delete, transfer, collaborator management or slug change", async ({ page, pageErrors }) => {
    await openSettings(page)
    await expect(page.getByText("Only the language owner can manage collaborators", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Invite Collaborator" })).toHaveCount(0)
    await expect(page.getByText("Danger Zone")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Delete Language" })).toHaveCount(0)
    await expect(page.getByText("Transfer Ownership", { exact: false })).toHaveCount(0)
    await expect(page.locator("#slug")).toBeDisabled()
    // Settings content the editor may change (write:settings) stays editable.
    await expect(page.locator("#name")).toBeEnabled()
    expectNoPageErrors(pageErrors)
  })

  test("public reader is not found", async ({ page, pageErrors }) => {
    await page.goto(`/lang/${SLUG}`)
    await expectNotFound(page)
    expectNoPageErrors(pageErrors)
  })
})

test.describe("owner", () => {
  signedInAs("owner")

  for (const studio of STUDIO_PAGES) {
    test(`can open studio ${studio.name}`, async ({ page, pageErrors }) => {
      await page.goto(studioUrl(studio.path))
      await expectStudioPage(page, studio.heading)
      await expect(page.locator("aside svg.lucide-lock")).toHaveCount(0)
      expectNoPageErrors(pageErrors)
    })
  }

  test("settings include delete, transfer and collaborator management", async ({ page, pageErrors }) => {
    await openSettings(page)
    await expect(page.locator("#slug")).toBeEnabled()
    await expect(page.getByText("Danger Zone")).toBeVisible()
    await expect(page.getByRole("button", { name: "Delete Language" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Invite Collaborator" })).toBeVisible()
    // Both collaborators are listed for the owner.
    await expect(page.getByText("E2E Editor").first()).toBeVisible()
    await expect(page.getByText("E2E Viewer").first()).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("has no public page: the reader 404s and the studio's View public is disabled", async ({ page, pageErrors }) => {
    // "Public pages 404 for private projects" (studio-layout.tsx), even for the owner.
    await page.goto(`/lang/${SLUG}`)
    await expectNotFound(page)
    await page.goto(studioUrl(""))
    await expectStudioPage(page, NAME)
    await expect(page.getByRole("button", { name: /^View Public/ })).toBeDisabled()
    expectNoPageErrors(pageErrors)
  })
})

test.describe("admin (not a collaborator)", () => {
  signedInAs("admin")

  for (const studio of STUDIO_PAGES) {
    test(`can open studio ${studio.name}`, async ({ page, pageErrors }) => {
      await page.goto(studioUrl(studio.path))
      await expectStudioPage(page, studio.heading)
      expectNoPageErrors(pageErrors)
    })
  }

  test("settings stay owner-only for delete and collaborators", async ({ page, pageErrors }) => {
    await openSettings(page)
    await expect(page.getByText("Only the language owner can manage collaborators", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Delete Language" })).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })
})
