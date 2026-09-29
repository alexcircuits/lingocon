import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

const TOKEN_TTL_DAYS = 90

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

function expiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + TOKEN_TTL_DAYS)
  return d
}

/**
 * Issue a new extension token for a user.
 * Returns the raw token (shown once) and its expiry.
 */
export async function issueExtensionToken(
  userId: string,
  name?: string
): Promise<{ rawToken: string; expiresAt: Date }> {
  const raw = randomBytes(32).toString("hex")
  const expiry = expiresAt()

  await prisma.extensionToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      name: name ?? null,
      expiresAt: expiry,
    },
  })

  return { rawToken: raw, expiresAt: expiry }
}

/**
 * Validate a raw Bearer token. Returns the userId on success, null otherwise.
 * Updates lastUsedAt on valid use.
 */
export async function validateExtensionToken(raw: string): Promise<string | null> {
  if (!raw) return null

  const hash = hashToken(raw)
  const now = new Date()

  const token = await prisma.extensionToken.findUnique({
    where: { tokenHash: hash },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { isSuspended: true } },
    },
  })

  if (!token) return null
  if (token.revokedAt !== null) return null
  if (token.expiresAt < now) return null
  if (token.user.isSuspended) return null

  // Update lastUsedAt without awaiting — fire and forget
  prisma.extensionToken
    .update({ where: { id: token.id }, data: { lastUsedAt: now } })
    .catch(() => {})

  return token.userId
}

/**
 * Revoke all active tokens for a user.
 */
export async function revokeAllExtensionTokens(userId: string): Promise<void> {
  await prisma.extensionToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Revoke a single token by its raw value.
 */
export async function revokeExtensionToken(raw: string): Promise<void> {
  await prisma.extensionToken.updateMany({
    where: { tokenHash: hashToken(raw) },
    data: { revokedAt: new Date() },
  })
}

/**
 * List active (non-revoked, non-expired) tokens for a user — metadata only, no hashes.
 */
export async function listExtensionTokens(userId: string) {
  return prisma.extensionToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, name: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Revoke a token by its DB id (used from the settings UI).
 */
export async function revokeExtensionTokenById(id: string, userId: string): Promise<void> {
  await prisma.extensionToken.updateMany({
    where: { id, userId },
    data: { revokedAt: new Date() },
  })
}

/**
 * Extract and validate a Bearer token from an Authorization header string.
 */
export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null
  return authHeader.slice(7).trim() || null
}
