import { test, expect, expectNoPageErrors, signedInAs, type Page } from "../fixtures"
import { E2E_USERS, authFile } from "../data"
import { db, userId } from "../db"
import {
  cleanupScratch,
  entryExists,
  interceptServerAction,
  privateLanguageId,
  replayServerAction,
  scratchLanguage,
  scratchPrivateWithCollaborators,
  swap,
  uniqueLemma,
} from "./helpers"

/**
 * Writes the UI would not offer, forced from a real session: a Server Action whose
 * arguments are edited in flight (as in devtools), a captured action replayed from
 * another user's session, and direct calls to the API routes that take a languageId.
 * Every rejection is checked in the database, not just in the response.
 *
 * Shared fixtures are only ever the *target* of rejected writes; successful writes go
 * to scratch languages (`scratchPrivateWithCollaborators` mirrors e2e-private's roles).
 */

const NO_PERMISSION = "You don't have permission to edit this language"
const NOT_PERMITTED = "You don't have permission to perform this action"

test.afterEach(cleanupScratch)

async function openAddEntry(page: Page, slug: string, lemma: string) {
  await page.goto(`/studio/lang/${slug}/dictionary`)
  await page.getByRole("button", { name: "Add Entry" }).first().click()
  const dialog = page.getByRole("dialog")
  await dialog.locator("#lemma").fill(lemma)
  await dialog.locator("#gloss").fill("forged")
  return dialog.getByRole("button", { name: "Add Entry" })
}

/** From a dictionary the user may edit, submit a new entry re-targeted at `targetId`. */
async function addEntryRetargeted(page: Page, own: { id: string; slug: string }, targetId: string, lemma: string) {
  const submit = await openAddEntry(page, own.slug, lemma)
  return interceptServerAction(page, () => submit.click(), {
    match: (body) => body.includes(lemma),
    rewrite: (body) => swap(body, own.id, targetId),
  })
}

function csvUpload(languageId: string, lemma: string) {
  return {
    multipart: {
      languageId,
      file: { name: "forged.csv", mimeType: "text/csv", buffer: Buffer.from(`lemma,gloss\n${lemma},forged\n`) },
    },
  }
}

test.describe("signed out", () => {
  test("API routes that take a languageId require a session", async ({ page }) => {
    const privateId = await privateLanguageId()
    const lemma = uniqueLemma()
    expect((await page.request.get(`/api/export/json?languageId=${privateId}`)).status()).toBe(401)
    expect((await page.request.post("/api/import/csv", csvUpload(privateId, lemma))).status()).toBe(401)
    expect((await page.request.put(`/api/translations/${privateId}`, { data: { translations: { "nav.home": "x" } } })).status()).toBe(401)
    expect(await entryExists(lemma)).toBe(false)
  })
})

test.describe("stranger", () => {
  signedInAs("stranger")

  test("a dictionary write re-targeted at e2e-private is rejected and nothing is written", async ({ page, pageErrors }) => {
    const own = await scratchLanguage("stranger")
    const lemma = uniqueLemma()
    const result = await addEntryRetargeted(page, own, await privateLanguageId(), lemma)
    expect(result.status).toBe(200)
    expect(result.responseText).toContain(NO_PERMISSION)
    await expect(page.getByText(NO_PERMISSION).first()).toBeVisible()
    expect(await entryExists(lemma)).toBe(false)
    expectNoPageErrors(pageErrors)
  })

  test("API routes refuse e2e-private: export, import, translations, slug lookup", async ({ page }) => {
    const privateId = await privateLanguageId()
    const lemma = uniqueLemma()

    expect((await page.request.get(`/api/export/json?languageId=${privateId}`)).status()).toBe(403)
    expect((await page.request.get(`/api/export/deck/${privateId}`)).status()).toBe(403)
    expect((await page.request.get(`/api/translations/${privateId}`)).status()).toBe(404)
    expect((await page.request.get("/api/internal/language-by-slug/e2e-private")).status()).toBe(404)

    const imported = await page.request.post("/api/import/csv", csvUpload(privateId, lemma))
    expect(imported.status()).toBe(403)
    expect(await entryExists(lemma)).toBe(false)

    const key = `nav.e2e-${lemma}`
    const put = await page.request.put(`/api/translations/${privateId}`, { data: { translations: { [key]: "forged" } } })
    expect(put.status()).toBe(403)
    expect(await db().conlangTranslation.count({ where: { languageId: privateId, key } })).toBe(0)
  })
})

test.describe("viewer (VIEWER collaborator)", () => {
  signedInAs("viewer")

  test("a dictionary write re-targeted at e2e-private is rejected and nothing is written", async ({ page, pageErrors }) => {
    const own = await scratchLanguage("viewer")
    const lemma = uniqueLemma()
    const result = await addEntryRetargeted(page, own, await privateLanguageId(), lemma)
    expect(result.responseText).toContain(NO_PERMISSION)
    await expect(page.getByText(NO_PERMISSION).first()).toBeVisible()
    expect(await entryExists(lemma)).toBe(false)
    expectNoPageErrors(pageErrors)
  })

  test("a shared language's dictionary is view-only: no Add Entry is offered", async ({ page, pageErrors }) => {
    // The server-side refusal of a forged create is covered above; the UI no longer offers it.
    const shared = await scratchPrivateWithCollaborators()
    await page.goto(`/studio/lang/${shared.slug}/dictionary`)
    await expect(page.getByText(/^View only/)).toBeVisible()
    await expect(page.getByRole("cell", { name: "kala", exact: true }).filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Add Entry" })).toHaveCount(0)
    expectNoPageErrors(pageErrors)
  })

  test("may export e2e-private but not import into it or change its translations", async ({ page }) => {
    const privateId = await privateLanguageId()
    const lemma = uniqueLemma()
    expect((await page.request.get(`/api/export/json?languageId=${privateId}`)).status()).toBe(200)
    expect((await page.request.post("/api/import/csv", csvUpload(privateId, lemma))).status()).toBe(403)
    expect(await entryExists(lemma)).toBe(false)
    const key = `nav.e2e-${lemma}`
    expect((await page.request.put(`/api/translations/${privateId}`, { data: { translations: { [key]: "x" } } })).status()).toBe(403)
    expect(await db().conlangTranslation.count({ where: { languageId: privateId, key } })).toBe(0)
  })
})

test.describe("editor (legacy EDITOR, full write)", () => {
  signedInAs("editor")

  test("adds a dictionary entry and it persists", async ({ page, pageErrors }) => {
    const shared = await scratchPrivateWithCollaborators()
    const lemma = uniqueLemma()
    const submit = await openAddEntry(page, shared.slug, lemma)
    await submit.click()
    await expect(page.getByText(`"${lemma}" added successfully`)).toBeVisible()
    await page.reload()
    await expect(page.getByRole("cell", { name: lemma, exact: true }).filter({ visible: true })).toBeVisible()
    const entry = await db().dictionaryEntry.findFirst({ where: { lemma }, select: { languageId: true, gloss: true } })
    expect(entry).toEqual({ languageId: shared.id, gloss: "forged" })
    expectNoPageErrors(pageErrors)
  })

  test("cannot delete the owner's language (delete re-targeted from an own language)", async ({ page, pageErrors }) => {
    const shared = await scratchPrivateWithCollaborators()
    const own = await scratchLanguage("editor")
    await page.goto(`/studio/lang/${own.slug}/settings`)
    // The collaborators panel loads lazily and fetches its list with a Server Action whose
    // body is just this language's id: let it settle so the intercept below catches the
    // action under test, and so the panel is hydrated before it is clicked.
    await expect(page.getByText("No collaborators yet")).toBeVisible()
    await page.getByRole("button", { name: "Delete Language" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder(own.name).fill(own.name)
    const result = await interceptServerAction(page, () => dialog.getByRole("button", { name: "Delete Language" }).click(), {
      match: (body) => body.includes(own.id),
      rewrite: (body) => swap(body, own.id, shared.id),
    })
    expect(result.responseText).toContain(NOT_PERMITTED)
    await expect(page.getByText(NOT_PERMITTED).first()).toBeVisible()
    expect(await db().language.count({ where: { id: { in: [shared.id, own.id] } } })).toBe(2)
    expectNoPageErrors(pageErrors)
  })

  test("cannot invite collaborators to the owner's language (invite re-targeted)", async ({ page, pageErrors }) => {
    const shared = await scratchPrivateWithCollaborators()
    const own = await scratchLanguage("editor")
    const strangerId = await userId("stranger")
    await page.goto(`/studio/lang/${own.slug}/settings`)
    // The collaborators panel loads lazily and fetches its list with a Server Action whose
    // body is just this language's id: let it settle so the intercept below catches the
    // action under test, and so the panel is hydrated before it is clicked.
    await expect(page.getByText("No collaborators yet")).toBeVisible()
    // The trigger is role=combobox without an accessible name; its text is the label.
    await page.getByRole("combobox").filter({ hasText: "Search by display name..." }).click()
    await page.getByPlaceholder("Search by display name...").fill("E2E Stranger")
    await page.getByRole("option", { name: "E2E Stranger" }).click()
    const result = await interceptServerAction(page, () => page.getByRole("button", { name: "Invite Collaborator" }).click(), {
      match: (body) => body.includes(strangerId) && body.includes("permissions"),
      rewrite: (body) => swap(body, own.id, shared.id),
    })
    expect(result.responseText).toContain("Only the language owner can invite collaborators")
    await expect(page.getByText("Only the language owner can invite collaborators")).toBeVisible()
    expect(await db().languageCollaborator.count({ where: { userId: strangerId, languageId: { in: [shared.id, own.id] } } })).toBe(0)
    expectNoPageErrors(pageErrors)
  })

  test("cannot change the slug (owner-only field), even with a forged save", async ({ page, pageErrors }) => {
    const shared = await scratchPrivateWithCollaborators()
    await page.goto(`/studio/lang/${shared.slug}/settings`)
    // Hydrated, and the collaborators list (same Server Action body shape) has loaded.
    await expect(page.getByText(E2E_USERS.viewer.name).first()).toBeVisible()
    await expect(page.locator("#slug")).toBeDisabled()
    const forged = `${shared.slug}-forged`
    await interceptServerAction(page, () => page.getByRole("button", { name: "Save Changes" }).click(), {
      match: (body) => body.includes(shared.id) && body.includes('"slug"'),
      rewrite: (body) => swap(body, `"slug":"${shared.slug}"`, `"slug":"${forged}"`),
    })
    const after = await db().language.findUniqueOrThrow({ where: { id: shared.id }, select: { slug: true } })
    expect(after.slug).toBe(shared.slug)
    expectNoPageErrors(pageErrors)
  })

  test("cannot make the owner's private language public", async ({ page, pageErrors }) => {
    test.fixme(
      true,
      "BUG?: a collaborator with write:settings can change visibility (form and updateLanguage allow it) — confirm whether visibility should be owner-only like slug/delete"
    )
    const shared = await scratchPrivateWithCollaborators()
    await page.goto(`/studio/lang/${shared.slug}/settings`)
    await page.locator("#visibility").click()
    await page.getByRole("option", { name: "Public" }).click()
    await page.getByRole("button", { name: "Save Changes" }).click()
    await expect(page.getByText(NOT_PERMITTED).first()).toBeVisible()
    const after = await db().language.findUniqueOrThrow({ where: { id: shared.id }, select: { visibility: true } })
    expect(after.visibility).toBe("PRIVATE")
    expectNoPageErrors(pageErrors)
  })
})

test.describe("owner", () => {
  signedInAs("owner")

  test("deletes an own language; the same action replayed by the editor or a stranger is rejected", async ({
    page,
    browser,
    pageErrors,
  }) => {
    const doomed = await scratchLanguage("owner")
    const shared = await scratchPrivateWithCollaborators()

    await page.goto(`/studio/lang/${doomed.slug}/settings`)
    // The collaborators list loads with a Server Action whose body is just the language id;
    // let it settle so the capture below takes the delete action.
    await expect(page.getByText("No collaborators yet")).toBeVisible()
    await page.getByRole("button", { name: "Delete Language" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder(doomed.name).fill(doomed.name)
    const { captured } = await interceptServerAction(page, () => dialog.getByRole("button", { name: "Delete Language" }).click(), {
      match: (body) => body.includes(doomed.id),
    })
    await page.waitForURL("**/dashboard")
    expect(await db().language.count({ where: { id: doomed.id } })).toBe(0)

    for (const role of ["editor", "stranger"] as const) {
      const context = await browser.newContext({ storageState: authFile(role) })
      try {
        const replay = await replayServerAction(context, captured, swap(captured.body, doomed.id, shared.id))
        expect(replay.text, `${role} replay`).toContain(NOT_PERMITTED)
      } finally {
        await context.close()
      }
      expect(await db().language.count({ where: { id: shared.id } }), `${role} replay left the language`).toBe(1)
    }

    // Control: the owner's own replay does delete it.
    const own = await replayServerAction(page.context(), captured, swap(captured.body, doomed.id, shared.id))
    expect(own.text).not.toContain(NOT_PERMITTED)
    expect(await db().language.count({ where: { id: shared.id } })).toBe(0)
    expectNoPageErrors(pageErrors)
  })

  test("adds a dictionary entry to an own private language", async ({ page, pageErrors }) => {
    const shared = await scratchPrivateWithCollaborators()
    const lemma = uniqueLemma()
    const submit = await openAddEntry(page, shared.slug, lemma)
    await submit.click()
    await expect(page.getByText(`"${lemma}" added successfully`)).toBeVisible()
    expect(await db().dictionaryEntry.count({ where: { lemma, languageId: shared.id } })).toBe(1)
    expectNoPageErrors(pageErrors)
  })
})

test.describe("admin (not a collaborator)", () => {
  signedInAs("admin")

  test("may moderate content: canEditScope grants admins every write scope", async ({ page, pageErrors }) => {
    const shared = await scratchPrivateWithCollaborators()
    const lemma = uniqueLemma()
    const submit = await openAddEntry(page, shared.slug, lemma)
    await submit.click()
    await expect(page.getByText(`"${lemma}" added successfully`)).toBeVisible()
    expect(await db().dictionaryEntry.count({ where: { lemma, languageId: shared.id } })).toBe(1)
    expectNoPageErrors(pageErrors)
  })
})
