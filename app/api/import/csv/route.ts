import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserId, canEditScope } from "@/lib/auth-helpers"
import { parseCSV, validateCSVData } from "@/lib/utils/csv-parser"
import { suggestIpaFromLemma } from "@/lib/utils/ipa-from-lemma"
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
    const canEdit = await canEditScope(languageId, userId, "write:dictionary")
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

    const scriptSymbols = await prisma.scriptSymbol.findMany({
      where: { languageId },
      select: { symbol: true, capitalSymbol: true, ipa: true },
    })
    const canSuggestIpa = scriptSymbols.some((s) => s.ipa)

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
        ipa:
          row.ipa?.trim() ||
          (canSuggestIpa ? suggestIpaFromLemma(lemma, scriptSymbols) || null : null),
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

    let insertedCount = 0
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      try {
        const result = await prisma.dictionaryEntry.createMany({
          data: batch as any,
          skipDuplicates: true,
        })
        insertedCount += result.count
      } catch (error) {
        // Log the database error; tell the user which rows failed without leaking internals.
        console.error("CSV import batch failed:", error)
        const first = batch[0]?.lemma ?? ""
        const last = batch[batch.length - 1]?.lemma ?? ""
        errors.push(
          `Rows ${i + 1}–${i + batch.length} (${first} … ${last}) could not be saved`
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
      // Rows actually written (createMany count), not attempted rows minus failed *batches*.
      imported: insertedCount,
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
      },
      { status: 500 }
    )
  }
}

