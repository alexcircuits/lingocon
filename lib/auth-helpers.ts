import { auth } from "@/auth"
import { getDevUserId } from "./dev-auth"
import { prisma } from "./prisma"
import { isAdmin } from "@/lib/admin"

export async function getUserId(): Promise<string | null> {
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
}

export async function requireAuth(): Promise<string> {
  const userId = await getUserId()
  if (!userId) {
    throw new Error("Unauthorized")
  }
  return userId
}

/**
 * Check if user can edit a language (owner or editor collaborator)
 */
export async function canEditLanguage(
  languageId: string,
  userId: string | null
): Promise<boolean> {
  if (!userId) return false

  // Admins can edit everything
  if (await isAdmin()) return true

  // Check if user is owner
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { ownerId: true },
  })

  if (language?.ownerId === userId) return true

  // Check if user is an editor collaborator
  const collaborator = await prisma.languageCollaborator.findUnique({
    where: {
      languageId_userId: {
        languageId,
        userId,
      },
    },
    select: { role: true },
  })

  return collaborator?.role === "EDITOR"
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

