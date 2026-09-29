/**
 * Activity log helpers for server code (actions, RSC loaders). Deliberately NOT a "use server"
 * module: Next registers every export of such a module as a callable endpoint, which previously let
 * anyone forge activity or read any user's activity (with emails and private-language names).
 * Client components go through the gated actions in `app/actions/activity.ts`.
 */
import "server-only"
import { prisma } from "@/lib/prisma"
import type { ActivityType, ActivityEntityType } from "@prisma/client"

interface CreateActivityInput {
  type: ActivityType
  entityType: ActivityEntityType
  entityId: string
  languageId: string
  userId: string
  description?: string
  metadata?: Record<string, any>
}

export async function createActivity(input: CreateActivityInput) {
  try {
    await prisma.activity.create({
      data: {
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        languageId: input.languageId,
        userId: input.userId,
        description: input.description || null,
        metadata: input.metadata ? (input.metadata as any) : null,
      },
    })
  } catch (error) {
    // Don't fail the main operation if activity logging fails
    console.error("Failed to create activity:", error)
  }
}

export async function getActivitiesForLanguage(
  languageId: string,
  limit: number = 20
) {
  return prisma.activity.findMany({
    where: { languageId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

const MAX_ACTIVITY_PAGE = 50

/**
 * A user's activity as seen by `viewerId`: their own profile shows everything, anyone else only sees
 * activity on PUBLIC languages (a profile must not advertise private or unlisted work).
 */
export async function getActivitiesForUser(
  userId: string,
  viewerId: string | null,
  limit: number = 20,
  cursor?: string
) {
  return prisma.activity.findMany({
    where: viewerId === userId ? { userId } : { userId, language: { visibility: "PUBLIC" } },
    include: {
      language: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), MAX_ACTIVITY_PAGE),
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })
}

export async function getRecentActivitiesForUserLanguages(
  userId: string,
  limit: number = 20
) {
  // Get languages owned or collaborated on by user
  const languages = await prisma.language.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          collaborators: {
            some: {
              userId,
            },
          },
        },
      ],
    },
    select: { id: true },
  })

  const languageIds = languages.map((l) => l.id)

  if (languageIds.length === 0) {
    return []
  }

  return prisma.activity.findMany({
    where: {
      languageId: {
        in: languageIds,
      },
    },
    include: {
      language: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function getFeedActivitiesForUser(userId: string, limit: number = 50, cursor?: string) {
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true }
  })
  const followingIds = follows.map(f => f.followingId)
  
  if (followingIds.length === 0) return []
  
  return prisma.activity.findMany({
    where: {
      userId: { in: followingIds },
      language: { visibility: "PUBLIC" }
    },
    include: {
      language: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), MAX_ACTIVITY_PAGE),
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })
}

