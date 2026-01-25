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

    // Check if image format is supported by PDFKit (JPG, PNG)
    // PDFKit does not support WebP, GIF, SVG, etc.
    if (flatPath) {
      const lower = flatPath.toLowerCase()
      const isSupported =
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png")

      if (!isSupported) {
        console.warn(`[PDF Export] Skipped unsupported image format: ${flatPath}`)
        flatPath = null
      }
    }

    if (flatPath && flatPath.startsWith("/uploads/")) {
      const absolutePath = join(process.cwd(), "public", flatPath)
      // Verify file exists to prevent PDF generation crash
      const { existsSync } = require("fs")
      if (existsSync(absolutePath)) {
        flatPath = absolutePath
      } else {
        console.warn(`Flag image not found at path: ${absolutePath}`)
        flatPath = null
      }
    }

    // Generate PDF
    let pdfBuffer: Buffer | Uint8Array
    try {
      const pdfDocument = React.createElement(LanguagePDFDocument, {
        language,
        flagUrl: flatPath,
        scriptSymbols: language.scriptSymbols,
        grammarPages: language.grammarPages,
        dictionaryEntries: language.dictionaryEntries,
        paradigms: language.paradigms,
      }) as React.ReactElement

      pdfBuffer = await renderToBuffer(pdfDocument)
    } catch (renderError) {
      const err = renderError as Error
      console.error("PDF Render Error:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
      })
      return NextResponse.json(
        {
          error: "Failed to render PDF document",
          stage: "render",
          details: err.message,
          errorName: err.name,
        },
        { status: 500 }
      )
    }

    // Convert to ArrayBuffer for NextResponse (ArrayBuffer is BodyInit compatible)
    const bufferData = Buffer.isBuffer(pdfBuffer)
      ? pdfBuffer
      : Buffer.from(pdfBuffer)

    // Create a new ArrayBuffer from the buffer data
    const uint8Array = new Uint8Array(bufferData)
    const arrayBuffer = uint8Array.buffer.slice(
      uint8Array.byteOffset,
      uint8Array.byteOffset + uint8Array.byteLength
    ) as ArrayBuffer

    // Return PDF as download
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${language.slug}-documentation.pdf"`,
        "Content-Length": bufferData.length.toString(),
      },
    })
  } catch (error) {
    const err = error as Error
    console.error("PDF Export Error:", {
      message: err.message,
      name: err.name,
      stack: err.stack,
    })
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        stage: "general",
        details: err.message,
        errorName: err.name,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
      { status: 500 }
    )
  }
}

