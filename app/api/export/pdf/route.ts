import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserId, canViewLanguage } from "@/lib/auth-helpers"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { join } from "path"
import { LanguagePDFDocument } from "@/lib/utils/pdf-generator-server"

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
      return NextResponse.json(
        { error: "Language ID is required" },
        { status: 400 }
      )
    }

    // Verify user can view this language
    const canView = await canViewLanguage(languageId, userId)
    if (!canView) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Fetch language data
    const language = await prisma.language.findUnique({
      where: { id: languageId },
      select: {
        name: true,
        description: true,
        slug: true,
        flagUrl: true,
        scriptSymbols: {
          orderBy: { order: "asc" },
          select: {
            symbol: true,
            ipa: true,
            latin: true,
            name: true,
            order: true,
          },
        },
        grammarPages: {
          orderBy: { order: "asc" },
          select: {
            title: true,
            slug: true,
            content: true,
            order: true,
          },
        },
        dictionaryEntries: {
          orderBy: { lemma: "asc" },
          select: {
            lemma: true,
            gloss: true,
            ipa: true,
            partOfSpeech: true,
            notes: true,
          },
        },
        paradigms: {
          select: {
            id: true,
            name: true,
            slots: true,
            notes: true,
          },
        },
      },
    })

    if (!language) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 })
    }

    // Resolve flag path to absolute disk path if it's a relative upload URL
    let flatPath = language.flagUrl
    if (flatPath && flatPath.startsWith("/uploads/")) {
      flatPath = join(process.cwd(), "public", flatPath)
    }

    // Generate PDF
    const pdfDocument = React.createElement(LanguagePDFDocument, {
      language,
      flagUrl: flatPath,
      scriptSymbols: language.scriptSymbols,
      grammarPages: language.grammarPages,
      dictionaryEntries: language.dictionaryEntries,
      paradigms: language.paradigms,
    }) as React.ReactElement

    const pdfBuffer = await renderToBuffer(pdfDocument)

    // Convert buffer to Uint8Array for NextResponse
    const pdfArray = Buffer.isBuffer(pdfBuffer)
      ? new Uint8Array(pdfBuffer)
      : new Uint8Array(pdfBuffer as ArrayBuffer)

    // Return PDF as download
    return new NextResponse(pdfArray, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${language.slug}-documentation.pdf"`,
        "Content-Length": pdfArray.length.toString(),
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    )
  }
}

