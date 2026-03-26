import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditLanguage } from "@/lib/auth-helpers"
import { parseCSV, validateCSVData } from "@/lib/utils/csv-parser"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const languageId = formData.get("languageId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId is required" },
        { status: 400 }
      )
    }

    // Verify edit permission
    const canEdit = await canEditLanguage(languageId, userId)
    if (!canEdit) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get language slug for revalidation
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { slug: true },
    })

    // Read file content
    const text = await file.text()

    // Parse CSV
    const rows = parseCSV(text)

    // Validate data
    const validation = validateCSVData(rows)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validation.errors,
        },
        { status: 400 }
      )
    }

    // Fetch all existing lemmas for this language in one query (case-sensitive)
    const existingEntries = await prisma.dictionaryEntry.findMany({
      where: { languageId },
      select: { lemma: true },
    })
    const existingLemmas = new Set(existingEntries.map((e) => e.lemma.trim()))

    // Deduplicate within the CSV itself (case-sensitive) and against existing DB entries
    const created: string[] = []
    const skipped: string[] = []
    const seenInFile = new Set<string>()
    const toInsert: {
      languageId: string
      lemma: string
      gloss: string
      ipa: string | null
      partOfSpeech: string | null
      notes: string | null
      etymology: string | null
      tags: string[] | null
      relatedWords: string[] | null
    }[] = []

    for (const row of rows) {
      const lemma = row.lemma.trim()

      // Skip if already exists in DB (case-sensitive)
      if (existingLemmas.has(lemma)) {
        skipped.push(lemma)
        continue
      }

      // Skip if duplicate within this CSV file (case-sensitive)
      if (seenInFile.has(lemma)) {
        skipped.push(lemma)
        continue
      }

      seenInFile.add(lemma)
      created.push(lemma)

      // Parse tags & relatedWords from semicolon-separated strings
      const rawTags = row.tags?.trim()
      const parsedTags = rawTags
        ? rawTags.split(/[;|]/).map((t: string) => t.trim().toLowerCase()).filter(Boolean)
        : null

      const rawRelated = row.relatedWords?.trim()
      const parsedRelated = rawRelated
        ? rawRelated.split(/[;|]/).map((w: string) => w.trim()).filter(Boolean)
        : null

      toInsert.push({
        languageId,
        lemma,
        gloss: row.gloss.trim(),
        ipa: row.ipa?.trim() || null,
        partOfSpeech: row.partOfSpeech?.trim() || null,
        notes: row.notes?.trim() || null,
        etymology: row.etymology?.trim() || null,
        tags: parsedTags && parsedTags.length > 0 ? parsedTags : null,
        relatedWords: parsedRelated && parsedRelated.length > 0 ? parsedRelated : null,
      })
    }

    // Batch insert in chunks of 500 to avoid query size limits
    const BATCH_SIZE = 500
    const errors: string[] = []

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      try {
        await prisma.dictionaryEntry.createMany({
          data: batch as any,
          skipDuplicates: true,
        })
      } catch (error) {
        const batchLemmas = batch.map((b) => b.lemma).join(", ")
        errors.push(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed (${batchLemmas}): ${error instanceof Error ? error.message : "Unknown error"
          }`
        )
      }
    }

    // Revalidate the dictionary page
    if (language?.slug) {
      revalidatePath(`/studio/lang/${language.slug}/dictionary`)
      revalidatePath(`/lang/${language.slug}/dictionary`)
    }

    return NextResponse.json({
      success: true,
      imported: created.length - errors.length,
      skipped: skipped.length,
      errors: errors.length,
      details: {
        created,
        skipped,
        errors,
      },
      warnings: validation.errors.filter((e) => e.startsWith("Warning:")),
    })
  } catch (error) {
    console.error("CSV import error:", error)
    return NextResponse.json(
      {
        error: "Failed to import CSV",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

