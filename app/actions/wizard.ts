"use server"

import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { generateSlug } from "@/lib/utils/slug"

// Create Latin alphabet (a-z) for a language
export async function createLatinAlphabet(languageId: string) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    // Verify ownership
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { ownerId: true },
    })

    if (!language || (language.ownerId !== userId && process.env.DEV_MODE !== "true")) {
      return {
        error: "Unauthorized",
      }
    }

    // Check if symbols already exist
    const existing = await prisma.scriptSymbol.findFirst({
      where: { languageId },
    })

    if (existing) {
      return {
        error: "Alphabet already exists for this language",
      }
    }

    // Create a-z symbols
    const latinAlphabet = "abcdefghijklmnopqrstuvwxyz"
    const symbols = latinAlphabet.split("").map((char, index) => ({
      symbol: char,
      latin: char,
      ipa: null,
      name: null,
      order: index,
      languageId,
    }))

    await prisma.scriptSymbol.createMany({
      data: symbols,
    })

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to create Latin alphabet",
    }
  }
}

// Create starter grammar pages
export async function createGrammarScaffold(languageId: string) {
  const userId = await getUserId()

  if (!userId) {
    return {
      error: "Unauthorized",
    }
  }

  try {
    // Verify ownership
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { ownerId: true },
    })

    if (!language || (language.ownerId !== userId && process.env.DEV_MODE !== "true")) {
      return {
        error: "Unauthorized",
      }
    }

    // Check if pages already exist
    const existing = await prisma.grammarPage.findFirst({
      where: { languageId },
    })

    if (existing) {
      return {
        error: "Grammar pages already exist for this language",
      }
    }

    // Create starter pages
    const starterPages = [
      { title: "Phonology", slug: "phonology" },
      { title: "Nouns", slug: "nouns" },
      { title: "Verbs", slug: "verbs" },
      { title: "Syntax", slug: "syntax" },
    ]

    const defaultContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    }

    const pages = starterPages.map((page, index) => ({
      title: page.title,
      slug: page.slug,
      content: defaultContent,
      order: index,
      languageId,
    }))

    await prisma.grammarPage.createMany({
      data: pages,
    })

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      }
    }
    return {
      error: "Failed to create grammar scaffold",
    }
  }
}

