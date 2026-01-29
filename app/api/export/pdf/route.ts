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

    // Sanitize data to prevent PDF rendering crashes from invalid numbers
    // The @react-pdf/renderer library cannot handle very large numbers
    const sanitizeForPDF = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) return obj
      if (typeof obj === "number") {
        if (!Number.isFinite(obj) || Math.abs(obj) > 1e15) {
          return 0 // Replace invalid/huge numbers with 0
        }
        return obj
      }
      if (typeof obj === "string") return obj
      if (typeof obj === "boolean") return obj
      if (Array.isArray(obj)) {
        return obj.map(sanitizeForPDF)
      }
      if (typeof obj === "object") {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(obj)) {
          result[key] = sanitizeForPDF(value)
        }
        return result
      }
      return obj
    }

    // Sanitize all data that contains JSON content
    const sanitizedGrammarPages = language.grammarPages.map(page => ({
      ...page,
      content: sanitizeForPDF(page.content),
      order: Number.isFinite(page.order) ? page.order : 0,
    }))

    const sanitizedParadigms = language.paradigms.map(p => ({
      ...p,
      slots: sanitizeForPDF(p.slots),
    }))

    const sanitizedScriptSymbols = language.scriptSymbols.map(s => ({
      ...s,
      order: Number.isFinite(s.order) ? s.order : 0,
    }))

    // Flag images removed as per user request
    const flagBuffer = null

    // Generate PDF
    let pdfBuffer: Buffer | Uint8Array
    try {
      const pdfDocument = React.createElement(LanguagePDFDocument, {
        language,
        flagUrl: null,
        scriptSymbols: sanitizedScriptSymbols,
        grammarPages: sanitizedGrammarPages,
        dictionaryEntries: language.dictionaryEntries,
        paradigms: sanitizedParadigms,
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


