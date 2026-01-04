"use server"

import { prisma } from "@/lib/prisma"
import { getUserId, isLanguageOwner } from "@/lib/auth-helpers"
import { ZodError } from "zod"
import {
  inviteCollaboratorSchema,
  updateCollaboratorRoleSchema,
  removeCollaboratorSchema,
} from "@/lib/validations/collaborator"

export async function inviteCollaborator(input: {
  languageId: string
  email: string
  role: "OWNER" | "EDITOR" | "VIEWER"
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

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: validated.email },
      select: { id: true, name: true, email: true },
    })

    if (!targetUser) {
      return { error: "User with this email not found" }
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

    // Create collaborator
    const collaborator = await prisma.languageCollaborator.create({
      data: {
        languageId: validated.languageId,
        userId: targetUser.id,
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
      error: "Failed to invite collaborator",
    }
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
          email: true,
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


