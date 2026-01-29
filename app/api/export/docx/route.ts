import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { fetchLanguageForExport } from "@/lib/services/export-service"
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle } from "docx"

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

        // Build the DOCX section children
        const children = []

        // Title
        children.push(
            new Paragraph({
                text: language.name,
                heading: HeadingLevel.TITLE,
            })
        )

        if (language.description) {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: language.description, italics: true })],
                    spacing: { after: 200 },
                })
            )
        }

        // Alphabet Section
        if (language.scriptSymbols.length > 0) {
            children.push(
                new Paragraph({
                    text: "Alphabet & Script",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                })
            )

            // Create Table
            const headerRow = new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: "Symbol", style: "Strong" })] }),
                    new TableCell({ children: [new Paragraph({ text: "IPA", style: "Strong" })] }),
                    new TableCell({ children: [new Paragraph({ text: "Latin", style: "Strong" })] }),
                    new TableCell({ children: [new Paragraph({ text: "Name", style: "Strong" })] }),
                ],
            })

            const rows = language.scriptSymbols.map((sym) =>
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(sym.symbol)] }),
                        new TableCell({ children: [new Paragraph(sym.ipa || "")] }),
                        new TableCell({ children: [new Paragraph(sym.latin || "")] }),
                        new TableCell({ children: [new Paragraph(sym.name || "")] }),
                    ],
                })
            )

            children.push(
                new Table({
                    rows: [headerRow, ...rows],
                    width: { size: 100, type: "pct" },
                })
            )
        }

        // Grammar Section
        if (language.grammarPages.length > 0) {
            children.push(
                new Paragraph({
                    text: "Grammar",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                })
            )

            language.grammarPages.forEach((page) => {
                children.push(
                    new Paragraph({
                        text: page.title,
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 200, after: 100 },
                    })
                )

                // Handling rich text content from TipTap JSON is complex.
                // For this MVP, we will extract plain text if possible, or just note it's present.
                // A full Tiptap->DOCX converter is out of scope for a simple export unless we find a library.
                // We will attempt a very basic recursion to find text nodes.
                const plainText = extractTextFromTipTap(page.content)
                children.push(
                    new Paragraph({
                        children: [new TextRun(plainText)],
                    })
                )
            })
        }

        // Dictionary Section
        if (language.dictionaryEntries.length > 0) {
            children.push(
                new Paragraph({
                    text: "Dictionary",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                    pageBreakBefore: true,
                })
            )

            language.dictionaryEntries.forEach((entry) => {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: entry.lemma, bold: true, size: 24 }), // 12pt
                            new TextRun({ text: `  /${entry.ipa || ""}/`, italics: true }),
                            new TextRun({ text: `  (${entry.partOfSpeech || "?"})`, color: "666666" }),
                        ],
                        spacing: { before: 100 },
                    })
                )
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: entry.gloss }),
                        ],
                        indent: { left: 720 }, // 0.5 inch
                    })
                )
                if (entry.notes) {
                    children.push(
                        new Paragraph({
                            children: [new TextRun({ text: `Note: ${entry.notes}`, italics: true, size: 20 })],
                            indent: { left: 720 },
                        })
                    )
                }
            })
        }

        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: children,
                },
            ],
        })

        const buffer = await Packer.toBuffer(doc)

        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${language.slug}-documentation.docx"`,
            },
        })

    } catch (error) {
        const err = error as Error
        console.error("DOCX Export Error:", err)

        if (err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }
        if (err.message === "Language not found") {
            return NextResponse.json({ error: "Language not found" }, { status: 404 })
        }

        return NextResponse.json({ error: "Failed to export DOCX" }, { status: 500 })
    }
}

// Helper to extract text from TipTap JSON
function extractTextFromTipTap(content: any): string {
    if (!content) return ""
    if (typeof content === "string") return content

    let text = ""

    if (content.type === "text" && content.text) {
        text += content.text
    }

    if (content.content && Array.isArray(content.content)) {
        content.content.forEach((child: any) => {
            text += extractTextFromTipTap(child) + "\n"
        })
    }

    return text.trim()
}
