"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { unstable_cache } from "next/cache"
import {
  findRootId,
  getDescendantIds,
  hasCircularReference,
} from "@/lib/utils/family-graph"

/**
 * Set or remove the parent language for a given language.
 * Allows cross-user parents if the parent language is PUBLIC.
 */
export async function setParentLanguage(
  languageId: string,
  parentLanguageId: string | null
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    // Only the owner of the CHILD can modify its parent
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { ownerId: true },
    })

    if (!language || language.ownerId !== userId) {
      return { error: "Unauthorized" }
    }

    // If setting a parent, validate it
    if (parentLanguageId) {
      const parentLanguage = await prisma.language.findUnique({
        where: { id: parentLanguageId },
        select: { ownerId: true, visibility: true },
      })

      if (!parentLanguage) {
        return { error: "Parent language not found" }
      }

      // Parent must be owned by user OR be PUBLIC
      if (parentLanguage.ownerId !== userId && parentLanguage.visibility !== "PUBLIC") {
        return { error: "Can only set a public language or your own language as parent" }
      }

      // Prevent circular references — single CTE query instead of N serial queries
      const isCircular = await hasCircularReference(languageId, parentLanguageId)
      if (isCircular) {
        return { error: "Cannot create circular family tree" }
      }
    }

    await prisma.language.update({
      where: { id: languageId },
      data: { parentLanguageId },
    })

    revalidatePath(`/studio`)
    revalidatePath(`/lang`)
    return { success: true }
  } catch {
    return { error: "Failed to update parent language" }
  }
}

/**
 * Set or remove external ancestry label (e.g. "Proto-Indo-European").
 */
export async function setExternalAncestry(
  languageId: string,
  externalAncestry: string | null
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { ownerId: true },
    })

    if (!language || language.ownerId !== userId) {
      return { error: "Unauthorized" }
    }

    await prisma.language.update({
      where: { id: languageId },
      data: { externalAncestry: externalAncestry?.trim() || null },
    })

    revalidatePath(`/studio`)
    revalidatePath(`/lang`)
    return { success: true }
  } catch {
    return { error: "Failed to update external ancestry" }
  }
}

/**
 * Get the full family tree for a language (from root down).
 * Includes owner info for cross-user trees and external ancestry.
 * Cached with unstable_cache for SSR performance.
 */
export async function getLanguageFamilyTree(languageId: string) {
  // Verify the initial language exists and is accessible
  const initialLang = await prisma.language.findUnique({
    where: { id: languageId },
    select: { id: true, visibility: true, ownerId: true },
  })
  if (!initialLang) return null

  // If the language is private, only the owner can see its tree
  if (initialLang.visibility === "PRIVATE") {
    const userId = await getUserId()
    if (!userId || userId !== initialLang.ownerId) return null
  }

  // Use cached inner function for the expensive tree-building part
  return getCachedFamilyTree(languageId)
}

const getCachedFamilyTree = unstable_cache(
  async (languageId: string) => {
    // Find the root using a single CTE query
    const rootId = await findRootId(languageId)

    // Build tree from root downward with owner info
    const childSelect = {
      id: true,
      name: true,
      slug: true,
      visibility: true,
      externalAncestry: true,
      owner: { select: { id: true, name: true, image: true } },
      _count: { select: { dictionaryEntries: true } },
    } as const

    const childInclude = (depth: number): any => {
      if (depth <= 0) return { select: childSelect }
      return {
        select: {
          ...childSelect,
          childLanguages: childInclude(depth - 1),
        },
      }
    }

    const rootTree = await prisma.language.findUnique({
      where: { id: rootId },
      select: {
        ...childSelect,
        childLanguages: childInclude(5),
      },
    })

    if (!rootTree) return null;

    // If this root has external ancestry, fetch ALL roots with the same external ancestry
    if (rootTree.externalAncestry) {
      const siblingRoots = await prisma.language.findMany({
        where: {
          externalAncestry: rootTree.externalAncestry,
          parentLanguageId: null, // Only top-level languages
          id: { not: rootId } // Don't fetch the one we already have
        },
        select: {
          ...childSelect,
          childLanguages: childInclude(5),
        },
        take: 50, // Prevent unbounded results
      });

      if (siblingRoots.length > 0) {
        const safeId = encodeURIComponent(rootTree.externalAncestry)
        // Create a virtual root node wrapping all these families
        return {
          id: `virtual-${safeId}`,
          name: rootTree.externalAncestry,
          slug: "",
          externalAncestry: rootTree.externalAncestry,
          isVirtual: true,
          childLanguages: [rootTree, ...siblingRoots]
        } as any;
      }
    }

    return rootTree
  },
  ["family-tree"],
  { revalidate: 60, tags: ["family-tree"] }
)

/**
 * Search languages that could be set as parent.
 * Shows user's own languages + public languages matching query.
 */
export async function searchParentLanguages(
  languageId: string,
  query: string
) {
  const userId = await getUserId()
  if (!userId) return { own: [], public: [] }

  // Single CTE query to collect all descendant IDs (instead of BFS loop)
  const descendantIdList = await getDescendantIds(languageId)
  const excludeIds = [languageId, ...descendantIdList]

  const baseWhere = {
    id: { notIn: excludeIds },
    ...(query ? {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { slug: { contains: query, mode: "insensitive" as const } },
      ],
    } : {}),
  }

  const selectFields = {
    id: true,
    name: true,
    slug: true,
    owner: { select: { name: true } },
  }

  const [own, publicLangs] = await Promise.all([
    // User's own languages
    prisma.language.findMany({
      where: { ...baseWhere, ownerId: userId },
      select: selectFields,
      take: 20,
      orderBy: { name: "asc" },
    }),
    // Public languages from other users
    prisma.language.findMany({
      where: { ...baseWhere, ownerId: { not: userId }, visibility: "PUBLIC" },
      select: selectFields,
      take: 20,
      orderBy: { name: "asc" },
    }),
  ])

  return { own, public: publicLangs }
}

/**
 * Get all distinct externalAncestry values from the database.
 * Used for autocomplete in the parent language card.
 */
export async function getExternalAncestries(): Promise<string[]> {
  const result = await prisma.language.findMany({
    where: {
      externalAncestry: { not: null },
    },
    select: { externalAncestry: true },
    distinct: ["externalAncestry"],
    orderBy: { externalAncestry: "asc" },
  })
  return result
    .map((r) => r.externalAncestry)
    .filter((v): v is string => v !== null)
}
