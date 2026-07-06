import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { fetchLanguageForExport } from "@/lib/services/export-service"
import { toAnkiCards } from "@/lib/export/anki-deck"
import { stringify } from "csv-stringify/sync"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: { languageId: string } }) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const language = await fetchLanguageForExport(params.languageId, userId)

    const cards = toAnkiCards(language.dictionaryEntries)

    const csvString = stringify(cards, {
      header: true,
      columns: ["front", "back"],
    })

    return new NextResponse(csvString, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${language.slug}-anki.csv"`,
      },
    })
  } catch (error) {
    const err = error as Error
    console.error("Anki Deck Export Error:", err)

    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    if (err.message === "Language not found") {
      return NextResponse.json({ error: "Language not found" }, { status: 404 })
    }

    return NextResponse.json({ error: "Failed to export Anki deck" }, { status: 500 })
  }
}
