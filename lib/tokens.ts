import crypto from "crypto"
import { prisma } from "@/lib/prisma"

const VERIFICATION_EXPIRY_HOURS = 24
const PASSWORD_RESET_EXPIRY_HOURS = 1
const RATE_LIMIT_MINUTES = 2

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
