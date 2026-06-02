"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, isLanguageOwner } from "@/lib/auth-helpers"
import { ZodError } from "zod"
import {
  inviteCollaboratorSchema,
  updateCollaboratorRoleSchema,
  updateCollaboratorPermissionsSchema,
  removeCollaboratorSchema,
} from "@/lib/validations/collaborator"

export async function inviteCollaborator(input: {
  languageId: string
  email?: string
  userId?: string
  permissions: string[]
}) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  try {
    const validated = inviteCollaboratorSchema.parse(input)

    // Verify ownership
    const isOwner = await isLanguageOwner(validated.languageId, userId)
    if (!isOwner) {
      return { error: "Only the language owner can invite collaborators" }
    }

    let targetUser;

    if (validated.userId) {
      targetUser = await prisma.user.findUnique({
        where: { id: validated.userId },
        select: { id: true, name: true },
      })
    } else if (validated.email) {
      targetUser = await prisma.user.findUnique({
        where: { email: validated.email },
        select: { id: true, name: true },
      })
    }

    if (!targetUser) {
      return { error: "User not found" }
    }

    // Don't allow inviting the owner
    const language = await prisma.language.findUnique({
      where: { id: validated.languageId },
      select: { ownerId: true },
    })

    if (targetUser.id === language?.ownerId) {
      return { error: "Cannot invite the language owner as a collaborator" }
    }

    // Check if already a collaborator
    const existing = await prisma.languageCollaborator.findUnique({
      where: {
        languageId_userId: {
          languageId: validated.languageId,
          userId: targetUser.id,
        },
      },
    })

    if (existing) {
      return { error: "User is already a collaborator" }
    }

    const role = validated.permissions.length > 0 ? "EDITOR" : "VIEWER"

    // Create collaborator
    const collaborator = await prisma.languageCollaborator.create({
      data: {
        languageId: validated.languageId,
        userId: targetUser.id,
        role,
        permissions: validated.permissions,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return {
      success: true,
      data: collaborator,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message || "Validation failed",
      }
    }
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to invite collaborator",
    }
  }
}

/** Owner-only user lookup for invites / ownership transfer. Never returns email. */
export async function searchCollaboratorCandidates(languageId: string, query: string) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const isOwner = await isLanguageOwner(languageId, userId)
  if (!isOwner) {
    return { error: "Unauthorized" }
  }

  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return { success: true, data: [] }
  }

  try {
    const emailLookup = trimmed.includes("@")

    const users = await prisma.user.findMany({
      where: emailLookup
        ? {
            email: { equals: trimmed, mode: "insensitive" },
            NOT: { id: userId },
          }
        : {
            name: { contains: trimmed, mode: "insensitive" },
            NOT: { id: userId },
          },
      take: 10,
      select: {
        id: true,
        name: true,
        image: true,
      },
    })

    return { success: true, data: users }
  } catch {
    return { error: "Failed to search users" }
  }
}

export async function updateCollaboratorRole(input: {
  languageId: string
  userId: string
  role: "OWNER" | "EDITOR" | "VIEWER"
}) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  try {
    const validated = updateCollaboratorRoleSchema.parse(input)

    // Verify ownership
    const isOwner = await isLanguageOwner(validated.languageId, userId)
    if (!isOwner) {
      return { error: "Only the language owner can update collaborator roles" }
    }

    // Update collaborator role
    const collaborator = await prisma.languageCollaborator.update({
      where: {
        languageId_userId: {
          languageId: validated.languageId,
          userId: validated.userId,
        },
      },
      data: {
        role: validated.role,
      },
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
    })

    return {
      success: true,
      data: collaborator,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message || "Validation failed",
      }
    }
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to update collaborator role",
    }
  }
}

export async function updateCollaboratorPermissions(input: {
  languageId: string
  userId: string
  permissions: string[]
}) {
  const callerId = await getUserId()
  if (!callerId) return { error: "Unauthorized" }

  try {
    const validated = updateCollaboratorPermissionsSchema.parse(input)
    const isOwner = await isLanguageOwner(validated.languageId, callerId)
    if (!isOwner) return { error: "Only the language owner can update collaborator permissions" }

    const role = validated.permissions.length > 0 ? "EDITOR" : "VIEWER"

    const collaborator = await prisma.languageCollaborator.update({
      where: { languageId_userId: { languageId: validated.languageId, userId: validated.userId } },
      data: { role, permissions: validated.permissions },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    return { success: true, data: collaborator }
  } catch (error) {
    if (error instanceof ZodError) return { error: error.issues[0]?.message || "Validation failed" }
    if (error instanceof Error) return { error: error.message }
    return { error: "Failed to update collaborator permissions" }
  }
}

export async function removeCollaborator(input: {
  languageId: string
  userId: string
}) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  try {
    const validated = removeCollaboratorSchema.parse(input)

    // Verify ownership
    const isOwner = await isLanguageOwner(validated.languageId, userId)
    if (!isOwner) {
      return { error: "Only the language owner can remove collaborators" }
    }

    // Remove collaborator
    await prisma.languageCollaborator.delete({
      where: {
        languageId_userId: {
          languageId: validated.languageId,
          userId: validated.userId,
        },
      },
    })

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        error: error.issues[0]?.message || "Validation failed",
      }
    }
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to remove collaborator",
    }
  }
}

export async function transferLanguageOwnership(input: {
  languageId: string
  newOwnerId: string
}) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  const isOwner = await isLanguageOwner(input.languageId, userId)
  if (!isOwner) return { error: "Only the language owner can transfer ownership" }

  if (input.newOwnerId === userId) return { error: "You are already the owner" }

  const newOwner = await prisma.user.findUnique({
    where: { id: input.newOwnerId },
    select: { id: true, name: true },
  })
  if (!newOwner) return { error: "User not found" }

  try {
    await prisma.$transaction(async (tx) => {
      // Remove new owner from collaborators if they were one
      await tx.languageCollaborator.deleteMany({
        where: { languageId: input.languageId, userId: input.newOwnerId },
      })
      // Add old owner as Editor
      await tx.languageCollaborator.upsert({
        where: { languageId_userId: { languageId: input.languageId, userId } },
        update: { role: "EDITOR" },
        create: { languageId: input.languageId, userId, role: "EDITOR" },
      })
      // Transfer ownership
      await tx.language.update({
        where: { id: input.languageId },
        data: { ownerId: input.newOwnerId },
      })
    })
    return { success: true }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: "Failed to transfer ownership" }
  }
}

export async function getCollaborators(languageId: string) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  // Verify ownership or collaboration
  const { canViewLanguage } = await import("@/lib/auth-helpers")
  const canView = await canViewLanguage(languageId, userId)

  if (!canView) {
    return { error: "Unauthorized" }
  }

  const collaborators = await prisma.languageCollaborator.findMany({
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
    orderBy: { createdAt: "asc" },
  })

  return {
    success: true,
    data: collaborators,
  }
}


