"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { checkLanguageBadges } from "@/app/actions/badge"

const evolveLanguageSchema = z.object({
  parentId: z.string(),
  name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name is too long"),
  slug: z.string().min(2, "Slug must be at least 2 characters").max(50, "Slug is too long")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
})

export type EvolveLanguageInput = z.infer<typeof evolveLanguageSchema>

export async function evolveLanguage(input: EvolveLanguageInput) {
  const userId = await getUserId()

  if (!userId) {
    return { error: "Unauthorized" }
  }

  try {
    const validated = evolveLanguageSchema.parse(input)

    // Check slug uniqueness
    const existing = await prisma.language.findUnique({
      where: { slug: validated.slug },
    })

    if (existing) {
      return { error: "A language with this slug already exists" }
    }

    // Fetch parent data to clone
    const parent = await prisma.language.findUnique({
      where: { id: validated.parentId },
      include: {
        dictionaryEntries: true,
        scriptSymbols: true,
      }
    })

    if (!parent) {
      return { error: "Parent language not found" }
    }

    // Must be either the owner, or the language is public AND allows forking
    const isOwner = parent.ownerId === userId
    if (!isOwner && (parent.visibility !== "PUBLIC" || !parent.allowForking)) {
      return { error: "Parent language is not authorized to be forked" }
    }

    // Start a transaction to ensure all cloning succeeds together
    const newLanguage = await prisma.$transaction(async (tx) => {
      // 1. Create the new language referencing the parent
      const lang = await tx.language.create({
        data: {
          name: validated.name,
          slug: validated.slug,
          description: validated.description || null,
          visibility: validated.visibility,
          ownerId: userId,
          parentLanguageId: parent.id,
          // Clone aesthetic settings and metadata (phonology, etc.)
          flagUrl: parent.flagUrl,
          fontUrl: parent.fontUrl,
          fontFamily: parent.fontFamily,
          fontScale: parent.fontScale,
          allowsDiacritics: parent.allowsDiacritics,
          metadata: parent.metadata ? (parent.metadata as any) : null,
        },
      })

      // 2. Clone script symbols
      if (parent.scriptSymbols.length > 0) {
        await tx.scriptSymbol.createMany({
          data: parent.scriptSymbols.map(sym => ({
            languageId: lang.id,
            symbol: sym.symbol,
            capitalSymbol: sym.capitalSymbol,
            ipa: sym.ipa,
            latin: sym.latin,
            name: sym.name,
            order: sym.order,
          }))
        })
      }

      // 3. Clone dictionary entries. Note: we are not deep cloning tags 
      // or related words for simplicity, just the core etymons.
      if (parent.dictionaryEntries.length > 0) {
        await tx.dictionaryEntry.createMany({
          data: parent.dictionaryEntries.map(entry => ({
            languageId: lang.id,
            lemma: entry.lemma,
            partOfSpeech: entry.partOfSpeech,
            gloss: entry.gloss,
            ipa: entry.ipa,
            relatedWords: entry.relatedWords ? (entry.relatedWords as any) : [],
            notes: entry.notes,
            // Track etymology back to parent!
            etymology: `Derived from ${parent.name}: ${entry.lemma}`
          }))
        })
      }

      return lang
    })

    // Revalidate necessary paths
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/families")
    revalidatePath("/browse")
    
    // Check badges
    checkLanguageBadges(userId).catch(console.error)

    return {
      success: true,
      data: newLanguage,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation failed" }
    }
    console.error("Failed to evolve language", error)
    return { error: "Failed to create evolved language" }
  }
}
