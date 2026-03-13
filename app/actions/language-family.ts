"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"

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

      // Prevent circular references — walk up the parent chain
      let currentId: string | null = parentLanguageId
      let maxDepth = 100
      while (currentId && maxDepth-- > 0) {
        if (currentId === languageId) {
          return { error: "Cannot create circular family tree" }
        }
        const parent: { parentLanguageId: string | null } | null = await prisma.language.findUnique({
          where: { id: currentId },
          select: { parentLanguageId: true },
        })
        currentId = parent?.parentLanguageId || null
      }

      if (maxDepth <= 0) {
        return { error: "Family tree depth limit exceeded — possible circular reference" }
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

  // First, find the root by walking up (across users)
  let rootId = languageId
  let maxDepth = 100

  while (maxDepth-- > 0) {
    const lang = await prisma.language.findUnique({
      where: { id: rootId },
      select: { parentLanguageId: true },
    })
    if (!lang?.parentLanguageId) break
    rootId = lang.parentLanguageId
  }

  if (maxDepth <= 0) {
    // Depth limit exceeded — return null rather than a partial tree
    return null
  }

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
}

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

  // Collect descendant IDs to exclude (batched BFS to avoid N+1 queries)
  const descendantIds = new Set<string>()
  let currentBatch = [languageId]
  let safetyLimit = 20
  while (currentBatch.length > 0 && safetyLimit-- > 0) {
    const kids = await prisma.language.findMany({
      where: { parentLanguageId: { in: currentBatch } },
      select: { id: true },
    })
    currentBatch = []
    for (const kid of kids) {
      if (!descendantIds.has(kid.id)) {
        descendantIds.add(kid.id)
        currentBatch.push(kid.id)
      }
    }
  }
  const excludeIds = [languageId, ...Array.from(descendantIds)]

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
