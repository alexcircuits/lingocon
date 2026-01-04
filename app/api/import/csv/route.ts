import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"
import { parseCSV, validateCSVData } from "@/lib/utils/csv-parser"

export const dynamic = "force-dynamic"

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

    // Verify ownership
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: { ownerId: true },
    })

    if (!language || language.ownerId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

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

    // Import entries in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const created: string[] = []
      const skipped: string[] = []
      const errors: string[] = []

      for (const row of rows) {
        try {
          // Check if entry already exists (by lemma, case-insensitive)
          const existing = await tx.dictionaryEntry.findFirst({
            where: {
              languageId,
              lemma: {
                equals: row.lemma.trim(),
                mode: "insensitive",
              },
            },
          })

          if (existing) {
            skipped.push(row.lemma)
            continue
          }

          // Create new entry
          await tx.dictionaryEntry.create({
            data: {
              languageId,
              lemma: row.lemma.trim(),
              gloss: row.gloss.trim(),
              ipa: row.ipa?.trim() || null,
              partOfSpeech: row.partOfSpeech?.trim() || null,
              notes: row.notes?.trim() || null,
            },
          })

          created.push(row.lemma)
        } catch (error) {
          errors.push(`${row.lemma}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }

      return { created, skipped, errors }
    })

    return NextResponse.json({
      success: true,
      imported: results.created.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
      details: {
        created: results.created,
        skipped: results.skipped,
        errors: results.errors,
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

