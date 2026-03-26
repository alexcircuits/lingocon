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
        childLanguages: childInclude(10),
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

// Helper to generate unique slug from name
async function generateFamilySlug(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  let slug = base
  let counter = 1
  while (await prisma.languageFamily.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`
    counter++
  }
  return slug
}

/**
 * Create a new language family.
 */
export async function createFamily(data: {
  name: string
  description?: string
  visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC"
}) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const slug = await generateFamilySlug(data.name)
    const family = await prisma.languageFamily.create({
      data: {
        name: data.name.trim(),
        slug,
        description: data.description?.trim() || null,
        visibility: data.visibility || "PRIVATE",
        ownerId: userId,
      },
    })
    revalidatePath("/studio")
    revalidatePath("/dashboard/families")
    return { success: true, family }
  } catch {
    return { error: "Failed to create family" }
  }
}

/**
 * Update a language family.
 */
export async function updateFamily(
  familyId: string,
  data: { name?: string; description?: string; visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC" }
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const family = await prisma.languageFamily.findUnique({
      where: { id: familyId },
      select: { ownerId: true },
    })
    if (!family || family.ownerId !== userId) return { error: "Unauthorized" }

    await prisma.languageFamily.update({
      where: { id: familyId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() || null }),
        ...(data.visibility !== undefined && { visibility: data.visibility }),
      },
    })
    revalidatePath("/studio")
    revalidatePath("/dashboard/families")
    return { success: true }
  } catch {
    return { error: "Failed to update family" }
  }
}

/**
 * Delete a language family. Languages in it become unassigned.
 */
export async function deleteFamily(familyId: string) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const family = await prisma.languageFamily.findUnique({
      where: { id: familyId },
      select: { ownerId: true },
    })
    if (!family || family.ownerId !== userId) return { error: "Unauthorized" }

    await prisma.languageFamily.delete({ where: { id: familyId } })
    revalidatePath("/studio")
    revalidatePath("/dashboard/families")
    return { success: true }
  } catch {
    return { error: "Failed to delete family" }
  }
}

/**
 * Assign or remove a language from a family. Owner of the language can do this.
 */
export async function setLanguageFamily(
  languageId: string,
  familyId: string | null
) {
  const userId = await getUserId()
  if (!userId) return { error: "Unauthorized" }

  try {
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { ownerId: true },
    })
    if (!language || language.ownerId !== userId) return { error: "Unauthorized" }

    if (familyId) {
      const family = await prisma.languageFamily.findUnique({
        where: { id: familyId },
        select: { ownerId: true, visibility: true },
      })
      if (!family) return { error: "Family not found" }
      // Must own the family OR the family is PUBLIC
      if (family.ownerId !== userId && family.visibility !== "PUBLIC") {
        return { error: "Can only join your own families or public families" }
      }
    }

    await prisma.language.update({
      where: { id: languageId },
      data: { familyId },
    })
    revalidatePath("/studio")
    revalidatePath("/dashboard/families")
    return { success: true }
  } catch {
    return { error: "Failed to update language family" }
  }
}

/**
 * Get all families owned by the current user.
 */
export async function getUserFamilies() {
  const userId = await getUserId()
  if (!userId) return []

  return prisma.languageFamily.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      visibility: true,
      _count: { select: { languages: true } },
    },
    orderBy: { name: "asc" },
  })
}

/**
 * Search families the user can join (own + public).
 */
export async function searchFamilies(query: string) {
  const userId = await getUserId()
  if (!userId) return { own: [], public: [] }

  const baseWhere = query ? {
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { slug: { contains: query, mode: "insensitive" as const } },
    ],
  } : {}

  const selectFields = {
    id: true,
    name: true,
    slug: true,
    description: true,
    owner: { select: { name: true } },
    _count: { select: { languages: true } },
  }

  const [own, publicFamilies] = await Promise.all([
    prisma.languageFamily.findMany({
      where: { ...baseWhere, ownerId: userId },
      select: selectFields,
      take: 20,
      orderBy: { name: "asc" },
    }),
    prisma.languageFamily.findMany({
      where: { ...baseWhere, ownerId: { not: userId }, visibility: "PUBLIC" },
      select: selectFields,
      take: 20,
      orderBy: { name: "asc" },
    }),
  ])

  return { own, public: publicFamilies }
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
