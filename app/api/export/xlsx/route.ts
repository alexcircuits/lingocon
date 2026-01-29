import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { fetchLanguageForExport } from "@/lib/services/export-service"
import ExcelJS from "exceljs"

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

        const workbook = new ExcelJS.Workbook()
        workbook.creator = "LingoCon"
        workbook.lastModifiedBy = "LingoCon"
        workbook.created = new Date()
        workbook.modified = new Date()

        // Sheet 1: Metadata
        const metaSheet = workbook.addWorksheet("Info")
        metaSheet.columns = [
            { header: "Field", key: "field", width: 20 },
            { header: "Value", key: "value", width: 50 },
        ]
        metaSheet.addRows([
            { field: "Name", value: language.name },
            { field: "Description", value: language.description || "" },
            { field: "Slug", value: language.slug },
            { field: "Created At", value: language.createdAt.toISOString() },
            { field: "Author", value: language.owner?.name || "Unknown" },
        ])

        // Sheet 2: Alphabet
        if (language.scriptSymbols.length > 0) {
            const alphaSheet = workbook.addWorksheet("Alphabet")
            alphaSheet.columns = [
                { header: "Order", key: "order", width: 10 },
                { header: "Symbol", key: "symbol", width: 15 },
                { header: "IPA", key: "ipa", width: 15 },
                { header: "Latin", key: "latin", width: 15 },
                { header: "Name", key: "name", width: 20 },
            ]

            language.scriptSymbols.forEach((sym) => {
                alphaSheet.addRow({
                    order: sym.order,
                    symbol: sym.symbol,
                    ipa: sym.ipa,
                    latin: sym.latin,
                    name: sym.name,
                })
            })
        }

        // Sheet 3: Dictionary
        if (language.dictionaryEntries.length > 0) {
            const dictSheet = workbook.addWorksheet("Dictionary")
            dictSheet.columns = [
                { header: "Lemma", key: "lemma", width: 20 },
                { header: "Gloss", key: "gloss", width: 30 },
                { header: "IPA", key: "ipa", width: 20 },
                { header: "Part of Speech", key: "pos", width: 15 },
                { header: "Notes", key: "notes", width: 40 },
            ]

            language.dictionaryEntries.forEach((entry) => {
                dictSheet.addRow({
                    lemma: entry.lemma,
                    gloss: entry.gloss,
                    ipa: entry.ipa,
                    pos: entry.partOfSpeech,
                    notes: entry.notes,
                })
            })
        }

        // Sheet 4: Grammar
        if (language.grammarPages.length > 0) {
            const grammarSheet = workbook.addWorksheet("Grammar")
            grammarSheet.columns = [
                { header: "Order", key: "order", width: 10 },
                { header: "Title", key: "title", width: 30 },
                { header: "Content (JSON)", key: "content", width: 50 },
            ]

            language.grammarPages.forEach((page) => {
                grammarSheet.addRow({
                    order: page.order,
                    title: page.title,
                    content: JSON.stringify(page.content),
                })
            })
        }

        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${language.slug}-export.xlsx"`,
            },
        })

    } catch (error) {
        const err = error as Error
        console.error("XLSX Export Error:", err)

        if (err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }
        if (err.message === "Language not found") {
            return NextResponse.json({ error: "Language not found" }, { status: 404 })
        }

        return NextResponse.json({ error: "Failed to export Excel" }, { status: 500 })
    }
}
