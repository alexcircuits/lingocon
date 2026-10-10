import type { Prisma } from "@prisma/client"
import type { BrowserContext } from "@playwright/test"
import { expect, type Page } from "../fixtures"
import { createScratchLanguage, db, type ScratchLanguage } from "../db"

/**
 * Helpers for the studio authoring specs (owner role). Destructive flows run on a
 * scratch language per test; `cleanupScratch` deletes what a passing test created
 * (a failing test keeps its data for inspection).
 */

const createdIds = new Set<string>()
const createdSlugs = new Set<string>()

type ScratchOptions = Parameters<typeof createScratchLanguage>[1]

/** A fresh language owned by `owner` (alphabet a e i o u k l m n s t; entries kala, nemi by default). */
export async function scratchLanguage(options: ScratchOptions = {}): Promise<ScratchLanguage> {
  const language = await createScratchLanguage("owner", options)
  createdIds.add(language.id)
  return language
}

/** Delete a language created through the UI (by slug) when the test passes. */
export function cleanupLater(slug: string): void {
  createdSlugs.add(slug)
}

/** Use as `test.afterEach(async ({}, testInfo) => cleanupScratch(testInfo))`. */
export async function cleanupScratch(testInfo: { status?: string; expectedStatus: string }): Promise<void> {
  const ids = [...createdIds]
  const slugs = [...createdSlugs]
  createdIds.clear()
  createdSlugs.clear()
  if (testInfo.status !== testInfo.expectedStatus) return
  if (ids.length === 0 && slugs.length === 0) return
  await db().language.deleteMany({ where: { OR: [{ id: { in: ids } }, { slug: { in: slugs } }] } })
}

/** Replace the language's metadata document (phonology, sound-change rules…). */
export async function setMetadata(languageId: string, metadata: Prisma.InputJsonObject): Promise<void> {
  await db().language.update({ where: { id: languageId }, data: { metadata } })
}

/** Give every script symbol its own letter as IPA, so phonology and the word generator see phonemes. */
export async function setSymbolIpaToSymbol(languageId: string): Promise<void> {
  await db().$executeRaw`UPDATE script_symbols SET ipa = symbol WHERE "languageId" = ${languageId}`
}

export async function entryLemmas(languageId: string): Promise<string[]> {
  const entries = await db().dictionaryEntry.findMany({
    where: { languageId },
    select: { lemma: true },
    orderBy: { lemma: "asc" },
  })
  return entries.map((entry) => entry.lemma)
}

export async function symbolOrder(languageId: string): Promise<string[]> {
  const symbols = await db().scriptSymbol.findMany({
    where: { languageId },
    select: { symbol: true },
    orderBy: { order: "asc" },
  })
  return symbols.map((symbol) => symbol.symbol)
}

export function studioPath(slug: string, section = ""): string {
  return section ? `/studio/lang/${slug}/${section}` : `/studio/lang/${slug}`
}

/**
 * Records full document loads of the main frame. `framenavigated` also fires for
 * same-document history updates (Next's router calls replaceState after a Server
 * Action re-render), so each event is classified by whether a new document was
 * loaded: a window sentinel set now only disappears on a real page load.
 */
export interface DocumentLoadWatcher {
  /** framenavigated events seen on the main frame (same- and cross-document). */
  navigations: () => string[]
  /**
   * Fails if the main frame loaded a new document since `watchDocumentLoads` or, with
   * `pathname`, if any main-frame navigation (same-document included) left that path.
   */
  expectNoFullLoad: (pathname?: string) => Promise<void>
}

export async function watchDocumentLoads(page: Page): Promise<DocumentLoadWatcher> {
  const navigations: string[] = []
  let documentLoads = 0
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url())
  })
  page.on("domcontentloaded", () => {
    documentLoads += 1
  })
  await page.evaluate(() => {
    ;(window as unknown as { __e2eSameDocument?: boolean }).__e2eSameDocument = true
  })
  return {
    navigations: () => [...navigations],
    expectNoFullLoad: async (pathname?: string) => {
      if (pathname) {
        for (const url of navigations) expect(new URL(url).pathname, "navigated to another URL").toBe(pathname)
        expect(new URL(page.url()).pathname).toBe(pathname)
      }
      expect(documentLoads, `main frame reloaded; navigations: ${navigations.join(", ")}`).toBe(0)
      const sameDocument = await page.evaluate(
        () => (window as unknown as { __e2eSameDocument?: boolean }).__e2eSameDocument === true
      )
      expect(sameDocument, "the page was reloaded (window state lost)").toBe(true)
    },
  }
}

/** A language's card on /dashboard (the most recent one also gets a "Continue editing" link). */
export function dashboardCard(page: Page, language: { slug: string; name: string }) {
  return page
    .locator(`a[href="${studioPath(language.slug)}"]`)
    .filter({ has: page.getByRole("heading", { name: language.name, exact: true }) })
}

/** The studio sidebar (desktop). */
export function sidebar(page: Page) {
  return page.locator("aside")
}

/** Client-side navigation through the studio sidebar. */
export async function openStudioTab(page: Page, label: string): Promise<void> {
  await sidebar(page).getByRole("link", { name: label, exact: true }).click()
}

export type SidebarStat = "Entries" | "Pages" | "Symbols" | "Paradigms"

/** The number in a "<n> <label>" stat pill of the studio sidebar, e.g. sidebarStat(page, "Entries"). */
export function sidebarStat(page: Page, label: SidebarStat) {
  return sidebar(page)
    .locator("span.rounded-full")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("span.tabular-nums")
}

/** The language's content counts as the sidebar shows them, read from the database. */
export async function languageCounts(languageId: string): Promise<Record<SidebarStat, number>> {
  const [entries, pages, symbols, paradigms] = await Promise.all([
    db().dictionaryEntry.count({ where: { languageId } }),
    db().grammarPage.count({ where: { languageId } }),
    db().scriptSymbol.count({ where: { languageId } }),
    db().paradigm.count({ where: { languageId } }),
  ])
  return { Entries: entries, Pages: pages, Symbols: symbols, Paradigms: paradigms }
}

export async function expectSidebarCounts(page: Page, counts: Record<SidebarStat, number>): Promise<void> {
  for (const [label, value] of Object.entries(counts) as [SidebarStat, number][]) {
    await expect(sidebarStat(page, label), `${label} count`).toHaveText(String(value))
  }
}

/**
 * Mark the first-visit onboarding tours as seen (they are modal and cover the dashboard).
 * Pass the test's `context` to cover every page opened in it.
 */
export async function skipOnboardingTours(target: Pick<BrowserContext, "addInitScript">): Promise<void> {
  await target.addInitScript(() => {
    try {
      window.localStorage.setItem("dashboard-tour-completed", "true")
      window.localStorage.setItem("studio-tour-completed", "true")
    } catch {
      // Storage unavailable (opaque origin): nothing to skip.
    }
  })
}

/** A sonner toast with the given text. */
export function toast(page: Page, text: string | RegExp) {
  return page.locator("[data-sonner-toast]").filter({ hasText: text })
}
