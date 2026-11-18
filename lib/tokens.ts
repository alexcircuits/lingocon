import crypto from "crypto"
import { prisma } from "@/lib/prisma"

const VERIFICATION_EXPIRY_HOURS = 24
const PASSWORD_RESET_EXPIRY_HOURS = 1
const EMAIL_CHANGE_EXPIRY_HOURS = 1
const RATE_LIMIT_MINUTES = 2

/** Identifier of a pending email change: `email-change:<userId>:<newEmail>`. */
const EMAIL_CHANGE_PREFIX = "email-change:"

type TokenResult = {
  token: string
  isNew: boolean
}

export async function generateVerificationToken(email: string): Promise<TokenResult> {
  const existing = await prisma.verificationToken.findFirst({
    where: { identifier: email },
  })

  if (existing && existing.expires > new Date()) {
    const createdAt = existing.expires.getTime() - VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000
    if (Date.now() - createdAt < RATE_LIMIT_MINUTES * 60 * 1000) {
      return { token: existing.token, isNew: false }
    }
  }

  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000)

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  })

  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  })

  return { token, isNew: true }
}

export async function generatePasswordResetToken(email: string): Promise<TokenResult> {
  const identifier = `pwd-reset:${email}`

  const existing = await prisma.verificationToken.findFirst({
    where: { identifier },
  })

  if (existing && existing.expires > new Date()) {
    const createdAt = existing.expires.getTime() - PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000
    if (Date.now() - createdAt < RATE_LIMIT_MINUTES * 60 * 1000) {
      return { token: existing.token, isNew: false }
    }
  }

  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000)

  await prisma.verificationToken.deleteMany({
    where: { identifier },
  })

  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  })

  return { token, isNew: true }
}

export async function consumeVerificationToken(token: string) {
  const existing = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!existing) return null
  if (existing.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } })
    return null
  }
  if (existing.identifier.startsWith("pwd-reset:")) return null
  if (existing.identifier.startsWith(EMAIL_CHANGE_PREFIX)) return null

  await prisma.verificationToken.delete({ where: { token } })
  return existing.identifier
}

export async function consumePasswordResetToken(token: string) {
  const existing = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!existing) return null
  if (existing.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } })
    return null
  }
  if (!existing.identifier.startsWith("pwd-reset:")) return null

  await prisma.verificationToken.delete({ where: { token } })
  return existing.identifier.replace("pwd-reset:", "")
}

export type EmailChangeRequest = { userId: string; newEmail: string }

function emailChangeIdentifier(userId: string, newEmail: string): string {
  return `${EMAIL_CHANGE_PREFIX}${userId}:${newEmail}`
}

/** User ids are cuids (no colon), so the first colon after the prefix ends the id. */
function parseEmailChangeIdentifier(identifier: string): EmailChangeRequest | null {
  if (!identifier.startsWith(EMAIL_CHANGE_PREFIX)) return null
  const rest = identifier.slice(EMAIL_CHANGE_PREFIX.length)
  const separator = rest.indexOf(":")
  if (separator <= 0 || separator === rest.length - 1) return null
  return { userId: rest.slice(0, separator), newEmail: rest.slice(separator + 1) }
}

/**
 * A link that moves `userId`'s account to `newEmail` once opened. A user has at most
 * one pending change: asking again replaces it, except that the same address within
 * two minutes gets the link already sent (`isNew: false`) instead of another email.
 */
export async function generateEmailChangeToken(userId: string, newEmail: string): Promise<TokenResult> {
  const identifier = emailChangeIdentifier(userId, newEmail)

  const existing = await prisma.verificationToken.findFirst({
    where: { identifier },
  })

  if (existing && existing.expires > new Date()) {
    const createdAt = existing.expires.getTime() - EMAIL_CHANGE_EXPIRY_HOURS * 60 * 60 * 1000
    if (Date.now() - createdAt < RATE_LIMIT_MINUTES * 60 * 1000) {
      return { token: existing.token, isNew: false }
    }
  }

  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + EMAIL_CHANGE_EXPIRY_HOURS * 60 * 60 * 1000)

  await cancelEmailChange(userId)

  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  })

  return { token, isNew: true }
}

/** What an email-change link would do, without using it up (for the confirmation page). */
export async function peekEmailChangeToken(token: string): Promise<EmailChangeRequest | null> {
  const existing = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!existing || existing.expires < new Date()) return null
  return parseEmailChangeIdentifier(existing.identifier)
}

export async function consumeEmailChangeToken(token: string): Promise<EmailChangeRequest | null> {
  const existing = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!existing) return null
  const request = parseEmailChangeIdentifier(existing.identifier)
  // Another kind of link (sign-up verification, password reset): leave it for its own flow.
  if (!request) return null

  // deleteMany reports how many rows it removed: of two confirmations racing on one link
  // (a double click, two tabs), only the one that actually deleted it goes on.
  const { count } = await prisma.verificationToken.deleteMany({ where: { token } })
  if (count === 0) return null
  if (existing.expires < new Date()) return null
  return request
}

/** The address a user is waiting to confirm, if any. */
export async function getPendingEmailChange(userId: string): Promise<string | null> {
  const existing = await prisma.verificationToken.findFirst({
    where: { identifier: { startsWith: `${EMAIL_CHANGE_PREFIX}${userId}:` } },
  })

  if (!existing || existing.expires < new Date()) return null
  return parseEmailChangeIdentifier(existing.identifier)?.newEmail ?? null
}

export async function cancelEmailChange(userId: string): Promise<void> {
  await prisma.verificationToken.deleteMany({
    where: { identifier: { startsWith: `${EMAIL_CHANGE_PREFIX}${userId}:` } },
  })
}
