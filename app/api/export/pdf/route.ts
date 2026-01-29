import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { renderToBuffer } from "@react-pdf/renderer"
import React from "react"
import { LanguagePDFDocument } from "@/lib/utils/pdf-generator-server"
import { fetchLanguageForExport } from "@/lib/services/export-service"

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

    // Fetch language data using shared service
    // This handles permission checks (throws if unauthorized or not found)
    const language = await fetchLanguageForExport(languageId, userId)

    // Flag images removed as per user request
    const flagBuffer = null

    // Generate PDF
    let pdfBuffer: Buffer | Uint8Array
    try {
      const pdfDocument = React.createElement(LanguagePDFDocument, {
        language,
        flagUrl: null,
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

    // Handle known errors
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    if (err.message === "Language not found") {
      return NextResponse.json({ error: "Language not found" }, { status: 404 })
    }

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


