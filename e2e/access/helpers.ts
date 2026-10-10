import { randomInt } from "crypto"
import bcrypt from "bcryptjs"
import type { BrowserContext, Page, Route } from "@playwright/test"
import { E2E_LANGUAGES, E2E_USERS, type E2eRole } from "../data"
import { createScratchLanguage, db, userId, type ScratchLanguage } from "../db"
import { expect, unique } from "../fixtures"

/**
 * Helpers for the access-control, account, learner and admin specs.
 *
 * Scratch users and languages are tracked per worker and deleted by `cleanupScratch`
 * when a test passes (a failing test keeps its rows for inspection).
 */

const createdUserIds = new Set<string>()
const createdLanguageIds = new Set<string>()

/** Use as `test.afterEach(cleanupScratch)`. */
export async function cleanupScratch(
  // Playwright requires a destructured fixtures argument, even when none is used.
  // eslint-disable-next-line no-empty-pattern
  {}: object,
  testInfo: { status?: string; expectedStatus: string }
): Promise<void> {
  const users = [...createdUserIds]
  const languages = [...createdLanguageIds]
  createdUserIds.clear()
  createdLanguageIds.clear()
  if (testInfo.status !== testInfo.expectedStatus) return
  // Users cascade to the languages, enrollments, tokens… they own.
  if (languages.length > 0) await db().language.deleteMany({ where: { id: { in: languages } } })
  if (users.length > 0) await db().user.deleteMany({ where: { id: { in: users } } })
}

// ─── Page states ──────────────────────────────────────────────────────────────

/** Both the site 404 and the studio's in-shell 404 render this heading (errors.pageNotFound). */
export async function expectNotFound(page: Page): Promise<void> {
  await expect(page.getByText("Page not found", { exact: true }).first()).toBeVisible()
}

/** Server redirects to /login (a streamed `redirect()` lands via a meta refresh, so wait for the URL). */
export async function expectLoginPage(page: Page): Promise<void> {
  await page.waitForURL(/\/login(\?|$)/)
  await expect(page.locator("#email")).toBeVisible()
}

/** Mark the dashboard and studio onboarding tours as done, so their overlay never covers a click. */
export async function skipOnboardingTours(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("dashboard-tour-completed", "true")
      window.localStorage.setItem("studio-tour-completed", "true")
    } catch {
      // Storage unavailable (opaque origin): the tour simply shows.
    }
  })
}

// ─── Fixture ids ──────────────────────────────────────────────────────────────

export async function languageIdBySlug(slug: string): Promise<string> {
  const language = await db().language.findUniqueOrThrow({ where: { slug }, select: { id: true } })
  return language.id
}

export function privateLanguageId(): Promise<string> {
  return languageIdBySlug(E2E_LANGUAGES.private)
}

export function publicLanguageId(): Promise<string> {
  return languageIdBySlug(E2E_LANGUAGES.public)
}

// ─── Scratch data ─────────────────────────────────────────────────────────────

export interface ScratchUser {
  id: string
  email: string
  name: string
  password: string
}

/** A verified account with a known password (bcrypt, like the seed). */
export async function createScratchUser(
  options: { suspended?: boolean; admin?: boolean; name?: string } = {}
): Promise<ScratchUser> {
  const suffix = unique()
  const email = `scratch-${suffix}@e2e.test`
  const password = `Scratch-${suffix}-Pass1`
  const name = options.name ?? `Scratch User ${suffix}`
  const user = await db().user.create({
    data: {
      email,
      name,
      password: await bcrypt.hash(password, 10),
      emailVerified: new Date(),
      isAdmin: options.admin ?? false,
      isSuspended: options.suspended ?? false,
      suspendedAt: options.suspended ? new Date() : null,
    },
    select: { id: true },
  })
  createdUserIds.add(user.id)
  return { id: user.id, email, name, password }
}

/** `createScratchLanguage` from e2e/db.ts, deleted again when the test passes. */
export async function scratchLanguage(
  role: E2eRole,
  options: Parameters<typeof createScratchLanguage>[1] = {}
): Promise<ScratchLanguage> {
  const language = await createScratchLanguage(role, options)
  createdLanguageIds.add(language.id)
  return language
}

/** A language owned by a scratch user (for flows that need a non-fixture owner). */
export async function scratchLanguageOwnedBy(
  ownerId: string,
  options: { visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED" } = {}
): Promise<ScratchLanguage> {
  const suffix = unique()
  const language = await db().language.create({
    data: {
      slug: `e2e-scratch-${suffix}`,
      name: `Scratch ${suffix}`,
      visibility: options.visibility ?? "PUBLIC",
      ownerId,
      dictionaryEntries: {
        create: [
          { lemma: "kala", gloss: "stone" },
          { lemma: "nemi", gloss: "name" },
        ],
      },
    },
    select: { id: true, slug: true, name: true },
  })
  createdLanguageIds.add(language.id)
  return language
}

/**
 * A PRIVATE language owned by `owner` with the same collaborator set as e2e-private
 * (editor = legacy EDITOR with empty permissions, viewer = VIEWER). Write tests run
 * here so the shared fixture's content never changes under the other specs.
 */
export async function scratchPrivateWithCollaborators(): Promise<ScratchLanguage> {
  const language = await scratchLanguage("owner", { visibility: "PRIVATE" })
  await db().languageCollaborator.createMany({
    data: [
      { languageId: language.id, userId: await userId("editor"), role: "EDITOR", permissions: [] },
      { languageId: language.id, userId: await userId("viewer"), role: "VIEWER", permissions: [] },
    ],
  })
  return language
}

// Letters in both the fixture alphabet (seed) and the scratch alphabet (createScratchLanguage).
const CONSONANTS = ["t", "k", "s", "m", "n", "l"]
const VOWELS = ["a", "e", "i", "o", "u"]

/**
 * A unique lemma written in letters every test language's alphabet has, made of CV
 * syllables so the fixtures' phonotactics check ((C)V(C)) accepts it too.
 */
export function uniqueLemma(syllables = 6): string {
  let lemma = ""
  for (let i = 0; i < syllables; i += 1) {
    lemma += CONSONANTS[randomInt(CONSONANTS.length)] + VOWELS[randomInt(VOWELS.length)]
  }
  return lemma
}

export async function entryExists(lemma: string): Promise<boolean> {
  return (await db().dictionaryEntry.count({ where: { lemma } })) > 0
}

// ─── Sign-in for scratch users ────────────────────────────────────────────────

/**
 * Credentials sign-in is rate limited per client IP (30 / 15 min), keyed on X-Real-IP
 * (set by nginx in production). Without a proxy every test shares one bucket with the
 * other suites, so each scratch sign-in presents its own address.
 */
export function isolateLoginRateLimit(page: Page): Promise<void> {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`
  return page.setExtraHTTPHeaders({ "x-real-ip": ip })
}

/** Submit the real /login form (does not wait for the outcome). */
export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await isolateLoginRateLimit(page)
  await page.goto("/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.locator('button[type="submit"]').click()
}

/** Sign a scratch user in through /login and wait for the dashboard. */
export async function signInThroughForm(page: Page, user: { email: string; password: string }): Promise<void> {
  await submitLogin(page, user.email, user.password)
  await page.waitForURL("**/dashboard", { timeout: 30_000 })
}

/** The session the browser holds, as /api/auth/session reports it (null when signed out). */
export async function sessionEmail(page: Page): Promise<string | null> {
  const response = await page.request.get("/api/auth/session")
  const body = (await response.json()) as { user?: { email?: string } } | null
  return body?.user?.email ?? null
}

export function fixtureEmail(role: E2eRole): string {
  return E2E_USERS[role].email
}

// ─── Server Action tampering and replay ───────────────────────────────────────

export interface CapturedAction {
  url: string
  headers: Record<string, string>
  body: string
}

/**
 * Run `trigger` and capture the first Server Action POST whose body satisfies `match`.
 * With `rewrite`, the body is changed in flight before it reaches the server, the way
 * an attacker edits the request in devtools. Resolves once the server has answered.
 */
export async function interceptServerAction(
  page: Page,
  trigger: () => Promise<unknown>,
  options: { match: (body: string) => boolean; rewrite?: (body: string) => string }
): Promise<{ captured: CapturedAction; status: number; responseText: string }> {
  let captured: CapturedAction | undefined
  let settle: (outcome: { status: number; text: string } | Error) => void = () => undefined
  const outcome = new Promise<{ status: number; text: string } | Error>((resolve) => {
    settle = resolve
  })
  const isTarget = (method: string, headers: Record<string, string>, body: string | null) =>
    method === "POST" && !!headers["next-action"] && body !== null && options.match(body)
  const notAsset = (url: URL) => !url.pathname.startsWith("/_next/")

  const handler = async (route: Route) => {
    const request = route.request()
    const body = request.postData()
    if (captured || !isTarget(request.method(), request.headers(), body)) return route.fallback()
    captured = { url: request.url(), headers: request.headers(), body: body ?? "" }
    try {
      const postData = options.rewrite?.(captured.body)
      if (postData === captured.body) throw new Error(`rewrite left the body unchanged: ${captured.body}`)
      // Fetch on the page's behalf so the response body can be read, then hand it back.
      const response = await route.fetch(postData === undefined ? undefined : { postData })
      const text = await response.text()
      settle({ status: response.status(), text })
      await route.fulfill({ response, body: text })
    } catch (error) {
      settle(error instanceof Error ? error : new Error(String(error)))
      await route.abort().catch(() => undefined)
    }
  }

  await page.route(notAsset, handler)
  let timer: NodeJS.Timeout | undefined
  try {
    await trigger()
    const timeout = new Promise<Error>((resolve) => {
      timer = setTimeout(() => resolve(new Error("no matching Server Action request within 30s")), 30_000)
    })
    const result = await Promise.race([outcome, timeout])
    if (result instanceof Error) throw result
    return { captured: captured as CapturedAction, status: result.status, responseText: result.text }
  } finally {
    clearTimeout(timer)
    await page.unroute(notAsset, handler)
  }
}

/**
 * Re-send a captured Server Action from another browser context (its cookies, i.e.
 * another user's session) with a new body. Action ids ship in the client bundle, so
 * any caller can do this; the server must authorize every call.
 */
export async function replayServerAction(
  context: BrowserContext,
  action: CapturedAction,
  body: string
): Promise<{ status: number; text: string }> {
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(action.headers)) {
    if (name !== "content-length" && name !== "cookie") headers[name] = value
  }
  const response = await context.request.post(action.url, { headers, data: body, maxRedirects: 0 })
  return { status: response.status(), text: await response.text() }
}

/** Replace every occurrence of `from` in a captured body, failing loudly if it is absent. */
export function swap(body: string, from: string, to: string): string {
  if (!body.includes(from)) throw new Error(`"${from}" not found in Server Action body: ${body}`)
  return body.split(from).join(to)
}
