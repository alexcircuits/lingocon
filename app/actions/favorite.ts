"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { checkFavoriteBadges } from "@/app/actions/badge"

export interface ToggleFavoriteInput {
  languageId: string
}

export interface ToggleFavoriteResult {
  isFavorite: boolean
  favoriteCount: number
}

export async function toggleFavorite(
  input: ToggleFavoriteInput
): Promise<{ data?: ToggleFavoriteResult; error?: string }> {
  try {
    const userId = await getUserId()

    if (!userId) {
      return { error: "You must be logged in to favorite languages" }
    }

    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_languageId: {
          userId,
          languageId: input.languageId,
        },
      },
    })

    if (existingFavorite) {
      // Remove favorite
      await prisma.favorite.delete({
        where: {
          id: existingFavorite.id,
        },
      })
    } else {
      // Add favorite
      await prisma.favorite.create({
        data: {
          userId,
          languageId: input.languageId,
        },
      })

      // Check for favorite badges for the language owner
      const language = await prisma.language.findUnique({
        where: { id: input.languageId },
        select: { ownerId: true },
      })
      if (language) {
        checkFavoriteBadges(language.ownerId).catch(console.error)
      }
    }

    // Get updated favorite count
    const favoriteCount = await prisma.favorite.count({
      where: {
        languageId: input.languageId,
      },
    })

    // Check if still favorited
    const isFavorite = !existingFavorite

    // Revalidate relevant paths
    revalidatePath(`/lang/[slug]`, "page")
    revalidatePath(`/dashboard`)

    return {
      data: {
        isFavorite,
        favoriteCount,
      },
    }
  } catch (error) {
    console.error("Error toggling favorite:", error)
    return { error: "Failed to update favorite" }
  }
}

export async function getUserFavorites(userId: string) {
  try {
    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
      },
      include: {
        language: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            flagUrl: true,
            visibility: true,
            _count: {
              select: {
                scriptSymbols: true,
                grammarPages: true,
                dictionaryEntries: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return favorites.map((fav) => fav.language)
  } catch (error) {
    console.error("Error fetching user favorites:", error)
    return []
  }
}

export async function checkIsFavorite(languageId: string, userId: string | null) {
  if (!userId) {
    return false
  }

  try {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_languageId: {
          userId,
          languageId,
        },
      },
    })

    return !!favorite
  } catch (error) {
    console.error("Error checking favorite:", error)
    return false
  }
}

export async function getFavoriteCount(languageId: string): Promise<number> {
  try {
    return await prisma.favorite.count({
      where: {
        languageId,
      },
    })
  } catch (error) {
    console.error("Error getting favorite count:", error)
    return 0
  }
}
