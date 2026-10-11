import { randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { expect, unique, type Page } from "../fixtures"
import { db } from "../db"

/**
 * Auth-flow helpers. Flows that create accounts use scratch users (never the fixture
 * roles) so password changes and failed attempts cannot affect other specs.
 */
export interface ScratchUser {
  id: string
  email: string
  name: string
  password: string
}

export function scratchEmail(prefix: string): string {
  return `e2e-${prefix}-${unique()}@e2e.test`
}

export async function createScratchUser(options: { verified?: boolean } = {}): Promise<ScratchUser> {
  const email = scratchEmail("user")
  const password = `Scratch-${unique()}-pass`
  const name = `Scratch ${unique()}`
  const user = await db().user.create({
    data: {
      email,
      name,
      password: await bcrypt.hash(password, 10),
      emailVerified: options.verified === false ? null : new Date(),
    },
    select: { id: true },
  })
  return { id: user.id, email, name, password }
}

/** Removes scratch users and every verification/reset token issued for them. */
export async function deleteScratchUsers(emails: string[]): Promise<void> {
  const identifiers = emails.flatMap((email) => [email, `pwd-reset:${email}`])
  await db().verificationToken.deleteMany({ where: { identifier: { in: identifiers } } })
  await db().user.deleteMany({ where: { email: { in: emails } } })
}

/** A password-reset token exactly as lib/tokens.ts stores it (identifier `pwd-reset:<email>`). */
export async function insertPasswordResetToken(email: string, expiresInMs = 60 * 60_000): Promise<string> {
  const token = randomUUID()
  await db().verificationToken.create({
    data: { identifier: `pwd-reset:${email}`, token, expires: new Date(Date.now() + expiresInMs) },
  })
  return token
}

/**
 * The server rate-limits sign-in, registration and reset requests per client IP, keyed on
 * X-Real-IP (which nginx sets in production). Giving each auth test its own address keeps
 * its attempts out of the shared bucket the other specs (and parallel runs) sign in from.
 */
export async function useOwnClientIp(page: Page): Promise<void> {
  const octet = () => Math.floor(Math.random() * 250) + 1
  await page.context().setExtraHTTPHeaders({ "x-real-ip": `10.${octet()}.${octet()}.${octet()}` })
}

/** Fill and submit the /login form; resolves when the credentials callback has answered. */
export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  const callback = page.waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"))
  await page.getByRole("button", { name: "Sign In with Email" }).click()
  await callback
}

/** The email of the session the browser context holds, or null when signed out. */
export async function sessionEmail(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/auth/session")
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as { user?: { email?: string } } | null
  return body?.user?.email ?? null
}
