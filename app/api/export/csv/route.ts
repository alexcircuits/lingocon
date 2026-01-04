import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

function escapeCSVField(field: string | null | undefined): string {
  if (!field) return ""
  // Escape quotes by doubling them, wrap in quotes if contains comma, quote, or newline
  const escaped = String(field).replace(/"/g, '""')
  if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
    return `"${escaped}"`
  }
  return escaped
}

function generateCSV(entries: Array<{
  lemma: string
  gloss: string
  ipa: string | null
  partOfSpeech: string | null
  notes: string | null
}>): string {
  const headers = ["Lemma", "Gloss", "IPA", "Part of Speech", "Notes"]
  const rows = entries.map((entry) => [
    escapeCSVField(entry.lemma),
    escapeCSVField(entry.gloss),
    escapeCSVField(entry.ipa),
    escapeCSVField(entry.partOfSpeech),
    escapeCSVField(entry.notes),
  ])

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const languageId = searchParams.get("languageId")

    if (!languageId) {
      return NextResponse.json(
        { error: "languageId parameter is required" },
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

    // Fetch dictionary entries
    const entries = await prisma.dictionaryEntry.findMany({
      where: { languageId },
      orderBy: { lemma: "asc" },
      select: {
        lemma: true,
        gloss: true,
        ipa: true,
        partOfSpeech: true,
        notes: true,
      },
    })

    // Generate CSV
    const csv = generateCSV(entries)

    // Return as downloadable file
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="dictionary-${languageId}.csv"`,
      },
    })
  } catch (error) {
    console.error("CSV export error:", error)
    return NextResponse.json(
      { error: "Failed to export CSV" },
      { status: 500 }
    )
  }
}

