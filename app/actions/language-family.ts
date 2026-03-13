"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"

/**
 * Set or remove the parent language for a given language.
 * This establishes the language family tree.
 */
export async function setParentLanguage(
  languageId: string,
  parentLanguageId: string | null
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

    // Prevent circular references
    if (parentLanguageId) {
      // Walk up the parent chain to make sure we don't create a cycle
      let currentId: string | null = parentLanguageId
      while (currentId) {
        if (currentId === languageId) {
          return { error: "Cannot create circular family tree" }
        }
        const parent: { parentLanguageId: string | null } | null = await prisma.language.findUnique({
          where: { id: currentId },
          select: { parentLanguageId: true },
        })
        currentId = parent?.parentLanguageId || null
      }
    }

    await prisma.language.update({
      where: { id: languageId },
      data: { parentLanguageId },
    })

    revalidatePath(`/studio`)
    return { success: true }
  } catch {
    return { error: "Failed to update parent language" }
  }
}

/**
 * Get the full family tree for a language (from root down).
 */
export async function getLanguageFamilyTree(languageId: string) {
  // First, find the root by walking up
  let rootId = languageId
  let maxDepth = 20 // Safety limit

  while (maxDepth-- > 0) {
    const lang = await prisma.language.findUnique({
      where: { id: rootId },
      select: { parentLanguageId: true },
    })
    if (!lang?.parentLanguageId) break
    rootId = lang.parentLanguageId
  }

  // Now build the tree from root downward
  return buildTreeNode(rootId)
}

async function buildTreeNode(languageId: string): Promise<any> {
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { dictionaryEntries: true } },
      childLanguages: {
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { dictionaryEntries: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  })

  if (!language) return null

  // Recursively build children
  const children = await Promise.all(
    language.childLanguages.map((child) => buildTreeNode(child.id))
  )

  return {
    ...language,
    childLanguages: children.filter(Boolean),
  }
}

/**
 * Search languages that could be set as parent (excluding self and descendants).
 */
export async function searchPotentialParents(
  languageId: string,
  query: string,
  ownerId: string
) {
  const languages = await prisma.language.findMany({
    where: {
      id: { not: languageId },
      ownerId,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  })

  return languages
}
