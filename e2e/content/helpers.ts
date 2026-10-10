import { request as playwrightRequest, type Browser, type Locator, type Page } from "@playwright/test"
import type { Prisma } from "@prisma/client"
import { createScratchLanguage, db, type ScratchLanguage } from "../db"
import { expect, expectNoPageErrors } from "../fixtures"

/**
 * Helpers for the studio content-authoring specs (grammar, articles, texts, courses,
 * flashcards, translate, modules, freshness). Arrangement goes through the database;
 * every flow under test goes through the UI.
 */

const scratchIds: string[] = []

/** A PUBLIC (by default) scratch language owned by `owner`, deleted by `cleanupScratchLanguages`. */
export async function ownerScratch(
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED" = "PUBLIC",
  entries?: { lemma: string; gloss: string }[]
): Promise<ScratchLanguage> {
  const language = await createScratchLanguage("owner", { visibility, entries })
  scratchIds.push(language.id)
  return language
}

/** Deletes the scratch languages this worker created (cascades to their content). */
export async function cleanupScratchLanguages(): Promise<void> {
  const ids = scratchIds.splice(0)
  if (ids.length === 0) return
  await db().language.deleteMany({ where: { id: { in: ids } } })
}

/** A TipTap document of plain paragraphs, as the editors store it. */
export function paragraphs(...texts: string[]): Prisma.InputJsonValue {
  return {
    type: "doc",
    content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  }
}

/** Grammar pages in the given order (order 0, 1, 2…), each with one paragraph of text. */
export async function addGrammarPages(
  languageId: string,
  pages: { title: string; slug: string; text: string }[]
): Promise<void> {
  await db().grammarPage.createMany({
    data: pages.map((page, order) => ({
      title: page.title,
      slug: page.slug,
      order,
      languageId,
      content: paragraphs(page.text),
    })),
  })
}

export interface PublicResponse {
  status: number
  html: string
}

/**
 * GET a URL as an anonymous visitor (no session cookie), the way a reader or a crawler sees it.
 * Owners can see their own drafts on public pages, so "not public" must be checked signed out.
 */
export async function anonymousGet(baseURL: string, path: string): Promise<PublicResponse> {
  const context = await playwrightRequest.newContext({ baseURL })
  try {
    const response = await context.get(path, { maxRedirects: 0 })
    return { status: response.status(), html: await response.text() }
  } finally {
    await context.dispose()
  }
}

/** The site 404 card (app/not-found.tsx). Its strings also ship in the client messages, so it is
 * checked in the rendered page, never in raw HTML. */
export const SITE_NOT_FOUND = "The page you're looking for doesn't exist or has been moved."

/** Records uncaught errors and console errors of a page opened outside the `page` fixture, the
 * same way the `pageErrors` fixture does; check them with `expectNoPageErrors`. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text())
  })
  return errors
}

/** Runs `fn` in a fresh signed-out browser context (no cookies, no storage); the page must not
 * raise client errors meanwhile. */
export async function asAnonymous<T>(browser: Browser, baseURL: string, fn: (page: Page) => Promise<T>): Promise<T> {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  try {
    const page = await context.newPage()
    const errors = collectPageErrors(page)
    const result = await fn(page)
    expectNoPageErrors(errors)
    return result
  } finally {
    await context.close()
  }
}

/** A signed-out visitor opening `path` gets the site's not-found page, without `absentText`. */
export async function expectNotFoundForReaders(
  browser: Browser,
  baseURL: string,
  path: string,
  absentText: string
): Promise<void> {
  await asAnonymous(browser, baseURL, async (page) => {
    await page.goto(path)
    await expect(page.getByText(SITE_NOT_FOUND)).toBeVisible()
    await expect(page.getByText(absentText)).toHaveCount(0)
  })
}

/** The rich-text editor (code-split; mounts after hydration). */
export async function richTextEditor(page: Page): Promise<Locator> {
  const editor = page.locator(".ProseMirror")
  await expect(editor).toBeVisible()
  return editor
}

/**
 * Clicks `trigger` and waits for the Server Action it posts to finish (the action has written and
 * revalidated by then). A toast is not a reliable signal for repeated saves: the previous save's
 * identical toast may still be on screen.
 */
export async function clickAndAwaitAction(page: Page, trigger: Locator): Promise<void> {
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined
  )
  await trigger.click()
  expect((await response).ok(), "server action response").toBe(true)
}

/** The toast sonner shows for a message. */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.locator("[data-sonner-toast]").filter({ hasText: text })
}

/**
 * Records whether `text` is ever rendered while the page is open — for transient UI (a "not
 * found" flash during a client transition) that a later assertion would miss. Read it back
 * with `sawText`.
 */
export async function watchForText(page: Page, key: string, text: string): Promise<void> {
  await page.evaluate(
    ({ key, text }) => {
      const flags = ((window as unknown as { __e2eSeen?: Record<string, boolean> }).__e2eSeen ??= {})
      // innerText: rendered text only — textContent would also match the RSC payload scripts and
      // the translation messages shipped to the client.
      const check = () => {
        if (!flags[key] && document.body.innerText.includes(text)) flags[key] = true
      }
      flags[key] = false
      check()
      new MutationObserver(check).observe(document.body, { childList: true, subtree: true, characterData: true })
    },
    { key, text }
  )
}

export async function sawText(page: Page, key: string): Promise<boolean> {
  return page.evaluate((key) => {
    const flags = (window as unknown as { __e2eSeen?: Record<string, boolean> }).__e2eSeen
    return Boolean(flags?.[key])
  }, key)
}

/**
 * Marks the current document so a test can tell a full page load (marker gone) from an
 * in-place React update (marker kept).
 */
export async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as { __e2eDocumentMarker?: boolean }).__e2eDocumentMarker = true
  })
}

export async function documentIsMarked(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean((window as unknown as { __e2eDocumentMarker?: boolean }).__e2eDocumentMarker))
}

/**
 * Headless Chromium never hides a page, so the tab switch is simulated: the page sees
 * `visibilityState` "hidden", the (installed) Playwright clock jumps `awayMs`, and the page
 * becomes "visible" again — the same events a user switching tabs produces.
 */
export async function simulateTabAway(page: Page, awayMs: number): Promise<void> {
  const setVisibility = (state: "hidden" | "visible") =>
    page.evaluate((state) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
      Object.defineProperty(document, "hidden", { configurable: true, get: () => state === "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
    }, state)
  await setVisibility("hidden")
  await page.clock.fastForward(awayMs)
  await setVisibility("visible")
}
