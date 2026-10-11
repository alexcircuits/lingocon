import { test, expect, expectNoPageErrors, signedInAs } from "../fixtures"
import { E2E_LANGUAGES } from "../data"
import { db } from "../db"
import {
  cleanupScratch,
  entryExists,
  expectLoginPage,
  interceptServerAction,
  publicLanguageId,
  scratchLanguage,
  swap,
  uniqueLemma,
} from "./helpers"

/**
 * The studio of a PUBLIC language opens for any signed-in user (canViewLanguage:
 * "public languages can be viewed by anyone") but every write needs a write scope,
 * which only the owner, collaborators and admins have.
 */

const SLUG = E2E_LANGUAGES.public
const NAME = "E2E Public Tongue"
const NO_PERMISSION = "You don't have permission to edit this language"

test.afterEach(cleanupScratch)

test("signed out: the studio of a public language redirects to /login", async ({ page, pageErrors }) => {
  await page.goto(`/studio/lang/${SLUG}/dictionary`)
  await expectLoginPage(page)
  expectNoPageErrors(pageErrors)
})

test.describe("stranger", () => {
  signedInAs("stranger")

  test("can open the studio read-only", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${SLUG}`)
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible()

    await page.goto(`/studio/lang/${SLUG}/dictionary`)
    await expect(page.getByRole("heading", { level: 1, name: "Dictionary" })).toBeVisible()
    await expect(page.getByRole("cell", { name: "tama", exact: true }).filter({ visible: true })).toBeVisible()
    for (const tab of ["Dictionary", "Grammar", "Alphabet"]) {
      await expect(page.locator("aside").getByRole("link", { name: tab, exact: true }).locator("svg.lucide-lock")).toBeVisible()
    }

    await page.goto(`/studio/lang/${SLUG}/grammar`)
    await expect(page.getByRole("heading", { level: 1, name: "Grammar" })).toBeVisible()
    await expect(page.getByText("Introduction").first()).toBeVisible()
    expectNoPageErrors(pageErrors)
  })

  test("settings show no owner controls", async ({ page, pageErrors }) => {
    await page.goto(`/studio/lang/${SLUG}/settings`)
    await expect(page.locator("#name")).toHaveValue(NAME)
    await expect(page.locator("#slug")).toBeDisabled()
    await expect(page.getByText("Only the language owner can manage collaborators", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Delete Language" })).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("the dictionary is view-only: no Add Entry is offered", async ({ page, pageErrors }) => {
    // Forged writes against this language are refused by the server (see the settings test
    // below and access/forced-writes.spec.ts); the UI no longer offers them.
    await page.goto(`/studio/lang/${SLUG}/dictionary`)
    await expect(page.getByText(/^View only/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Add Entry" })).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("a settings save re-targeted at the public language is rejected", async ({ page, pageErrors }) => {
    const own = await scratchLanguage("stranger")
    const publicId = await publicLanguageId()
    const forgedName = `Hijacked ${uniqueLemma(2)}`
    await page.goto(`/studio/lang/${own.slug}/settings`)
    await page.locator("#name").fill(forgedName)
    const result = await interceptServerAction(page, () => page.getByRole("button", { name: "Save Changes" }).click(), {
      match: (body) => body.includes(forgedName),
      // Point the save at e2e-public, keeping its own slug so only the authorization differs.
      rewrite: (body) => swap(swap(body, own.id, publicId), `"slug":"${own.slug}"`, `"slug":"${SLUG}"`),
    })
    expect(result.responseText).toContain("You don't have permission to perform this action")
    const after = await db().language.findUniqueOrThrow({ where: { id: publicId }, select: { name: true } })
    expect(after.name).toBe(NAME)
    expectNoPageErrors(pageErrors)
  })
})
