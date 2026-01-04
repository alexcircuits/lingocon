"use server"

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
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function getActivitiesForUser(userId: string, limit: number = 20) {
  return prisma.activity.findMany({
    where: { userId },
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
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
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
          email: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

