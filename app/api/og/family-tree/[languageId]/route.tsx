import { ImageResponse } from "next/og"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ languageId: string }> }
) {
  const { languageId } = await params

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: {
      name: true,
      slug: true,
      description: true,
      externalAncestry: true,
      owner: { select: { name: true } },
      _count: { select: { dictionaryEntries: true, childLanguages: true } },
      parentLanguage: { select: { name: true } },
    },
  })

  if (!language) {
    return new Response("Language not found", { status: 404 })
  }

  // Count tree depth upward
  let depth = 0
  let currentId: string | null = languageId
  while (currentId && depth < 20) {
    const parent: { parentLanguageId: string | null } | null = await prisma.language.findUnique({
      where: { id: currentId },
      select: { parentLanguageId: true },
    })
    if (!parent?.parentLanguageId) break
    currentId = parent.parentLanguageId
    depth++
  }

  // Count total descendants
  let descendantCount = 0
  let batch = [languageId]
  let limit = 10
  while (batch.length > 0 && limit-- > 0) {
    const kids = await prisma.language.findMany({
      where: { parentLanguageId: { in: batch } },
      select: { id: true },
    })
    descendantCount += kids.length
    batch = kids.map(k => k.id)
  }

  const familyLabel = language.externalAncestry || language.parentLanguage?.name || "Root language"
  const wordCount = language._count.dictionaryEntries
  const childCount = language._count.childLanguages

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)",
          fontFamily: "system-ui, sans-serif",
          color: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background decoration */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-80px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Family label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
            background: "rgba(139, 92, 246, 0.15)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "9999px",
            padding: "8px 20px",
            fontSize: "18px",
            color: "rgba(196, 181, 253, 1)",
          }}
        >
          🌳 {familyLabel}
        </div>

        {/* Language name */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            letterSpacing: "-2px",
            marginBottom: "12px",
            background: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          {language.name}
        </div>

        {/* Slug */}
        <div
          style={{
            fontSize: "20px",
            color: "rgba(148, 163, 184, 0.8)",
            marginBottom: "32px",
            display: "flex",
          }}
        >
          lingocon.com/lang/{language.slug}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              padding: "12px 24px",
            }}
          >
            <span style={{ fontSize: "28px", fontWeight: 700, color: "#60a5fa" }}>
              {wordCount}
            </span>
            <span style={{ fontSize: "16px", color: "rgba(148, 163, 184, 0.8)" }}>
              words
            </span>
          </div>

          {childCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "12px 24px",
              }}
            >
              <span style={{ fontSize: "28px", fontWeight: 700, color: "#a78bfa" }}>
                {childCount}
              </span>
              <span style={{ fontSize: "16px", color: "rgba(148, 163, 184, 0.8)" }}>
                daughter langs
              </span>
            </div>
          )}

          {depth > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "12px 24px",
              }}
            >
              <span style={{ fontSize: "28px", fontWeight: 700, color: "#34d399" }}>
                {depth}
              </span>
              <span style={{ fontSize: "16px", color: "rgba(148, 163, 184, 0.8)" }}>
                generations deep
              </span>
            </div>
          )}
        </div>

        {/* Author */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            right: "32px",
            fontSize: "14px",
            color: "rgba(148, 163, 184, 0.5)",
            display: "flex",
          }}
        >
          by {language.owner.name || "Anonymous"} • LingoCon
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
