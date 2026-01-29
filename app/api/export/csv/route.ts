import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { fetchLanguageForExport } from "@/lib/services/export-service"
import { stringify } from "csv-stringify/sync"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const languageId = searchParams.get("languageId")

    if (!languageId) {
      return NextResponse.json({ error: "Language ID is required" }, { status: 400 })
    }

    const language = await fetchLanguageForExport(languageId, userId)

    // Prepare data for CSV - We focus on Dictionary Entries
    const csvData = language.dictionaryEntries.map((entry) => ({
      Lemma: entry.lemma,
      Gloss: entry.gloss,
      IPA: entry.ipa || "",
      "Part of Speech": entry.partOfSpeech || "",
      Notes: entry.notes || "",
    }))

    const csvString = stringify(csvData, {
      header: true,
      columns: [
        "Lemma",
        "Gloss",
        "IPA",
        "Part of Speech",
        "Notes",
      ],
    })

    return new NextResponse(csvString, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${language.slug}-dictionary.csv"`,
      },
    })
  } catch (error) {
    const err = error as Error
    console.error("CSV Export Error:", err)

    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    if (err.message === "Language not found") {
      return NextResponse.json({ error: "Language not found" }, { status: 404 })
    }

    return NextResponse.json({ error: "Failed to export CSV" }, { status: 500 })
  }
}
