/**
 * Central authorization helpers for Server Actions, Route Handlers, and RSC data loaders.
 *
 * These functions sit *above* Prisma domain logic: they answer "who is the caller?" and
 * "may this user touch this language?" using session data plus explicit collaborator checks.
 *
 * @see `auth.ts` for how sessions are established (OAuth vs dev mode).
 */
import { auth } from "@/auth"
import { getDevUserId } from "./dev-auth"
import { prisma } from "./prisma"
import { isAdmin } from "@/lib/admin"
import type { LanguagePermission } from "@/lib/permissions"
import { requestCache } from "@/lib/request-cache"
export { EDITOR_DEFAULT_PERMISSIONS, FULL_EDITOR_PERMISSIONS } from "@/lib/permissions"
export type { LanguagePermission } from "@/lib/permissions"

/**
 * Returns the authenticated user's id, or `null` for guests / suspended accounts / missing session.
 * Memoized per request: a single studio render used to call this (and its suspension lookup) from
 * the layout, the page and every permission helper.
 */
export const getUserId = requestCache(async function getUserId(): Promise<string | null> {
  const session = await auth()
  if (session?.user?.id) {
    // Check if user is suspended
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSuspended: true },
    })
    if (user?.isSuspended) {
      return null
    }
    return session.user.id
  }
  if (process.env.DEV_MODE === "true") {
    return await getDevUserId()
  }
  return null
})

/** Same as `getUserId` but throws if unauthenticated — handy for actions that must never be public. */
export async function requireAuth(): Promise<string> {
  const userId = await getUserId()
  if (!userId) {
    throw new Error("Unauthorized")
  }
  return userId
}

/** Internal helper: fetch language + collaborator in one round-trip. */
async function getEditAccess(languageId: string, userId: string) {
  const [language, collaborator] = await Promise.all([
    prisma.language.findUnique({ where: { id: languageId }, select: { ownerId: true } }),
    prisma.languageCollaborator.findUnique({
      where: { languageId_userId: { languageId, userId } },
      select: { role: true, permissions: true },
    }),
  ])
  return { language, collaborator }
}

/**
 * Check if user can edit a language at all (owner, or collaborator with any write/manage permission).
 * Kept for backward compatibility at call sites not yet migrated to canEditScope.
 */
export async function canEditLanguage(
  languageId: string,
  userId: string | null
): Promise<boolean> {
  if (!userId) return false
  if (await isAdmin()) return true

  const { language, collaborator } = await getEditAccess(languageId, userId)
  if (language?.ownerId === userId) return true
  if (!collaborator) return false

  // Legacy EDITOR with empty permissions = full access (pre-migration rows)
  if (collaborator.role === "EDITOR" && collaborator.permissions.length === 0) return true

  return collaborator.permissions.some(
    (p) => p.startsWith("write:") || p.startsWith("manage:")
  )
}

/**
 * Check if user has a specific permission scope for a language.
 * Owners always pass. Use EDITOR_DEFAULT_PERMISSIONS for the available scopes.
 */
export async function canEditScope(
  languageId: string,
  userId: string | null,
  permission: LanguagePermission
): Promise<boolean> {
  if (!userId) return false
  if (await isAdmin()) return true

  const { language, collaborator } = await getEditAccess(languageId, userId)
  if (language?.ownerId === userId) return true
  if (!collaborator) return false

  // Legacy EDITOR with empty permissions = full access (pre-migration rows)
  if (collaborator.role === "EDITOR" && collaborator.permissions.length === 0) return true

  return collaborator.permissions.includes(permission)
}

/**
 * Check if user can view a language (owner, collaborator, or public)
 */
export async function canViewLanguage(
  languageId: string,
  userId: string | null
): Promise<boolean> {
  // Admins can view everything
  if (await isAdmin()) return true

  // Check if language exists and is public
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { ownerId: true, visibility: true },
  })

  if (!language) return false

  // Public languages can be viewed by anyone
  if (language.visibility === "PUBLIC") return true

  // Owner can always view
  if (userId && language.ownerId === userId) return true

  // Check if user is a collaborator (any role)
  if (userId) {
    const collaborator = await prisma.languageCollaborator.findUnique({
      where: {
        languageId_userId: {
          languageId,
          userId,
        },
      },
    })

    if (collaborator) return true
  }

  return false
}

/**
 * Read access to a language's content for data-returning actions: PUBLIC and UNLISTED ("anyone
 * with the link") are readable by everyone, PRIVATE only by the owner, collaborators and admins.
 * Prefer this over `canViewLanguage` for reads — that one also gates the studio and treats
 * UNLISTED as private.
 */
export async function canReadLanguage(
  languageId: string,
  userId: string | null
): Promise<boolean> {
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { visibility: true },
  })
  if (!language) return false
  if (language.visibility !== "PRIVATE") return true
  return canViewLanguage(languageId, userId)
}

/**
 * Check if user owns a language
 */
export async function isLanguageOwner(
  languageId: string,
  userId: string | null
): Promise<boolean> {
  if (!userId) return false

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { ownerId: true },
  })

  return language?.ownerId === userId
}

