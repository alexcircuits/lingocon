import { ImageResponse } from "next/og"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { loadOgFonts } from "@/lib/og-fonts"

export const runtime = "nodejs"

// Aurora brand palette (hex equivalents of app/globals.css dark theme — Satori's
// gradient parser can't handle comma-separated hsl()).
const BG = "#0a0c19"
const FG = "#f1f2f9"
const VIOLET = "#9378fc"
const PINK = "#ff61a8"
const BORDER = "#2c2f44"
const fg = (a: number) => `rgba(241, 242, 249, ${a})`

function nameSize(len: number): number {
  if (len > 22) return 66
  if (len > 16) return 86
  if (len > 10) return 108
  return 128
}

/** Bold, brand-themed Open Graph card for a language hub. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ languageId: string }> },
) {
  const { languageId } = await params

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: {
      name: true,
      slug: true,
      owner: { select: { name: true } },
      _count: { select: { dictionaryEntries: true, grammarPages: true, scriptSymbols: true } },
    },
  })

  if (!language) {
    return new Response("Language not found", { status: 404 })
  }

  const owner = language.owner.name || "an anonymous conlanger"
  const stats: { value: number; label: string }[] = [
    { value: language._count.dictionaryEntries, label: "entries" },
    { value: language._count.grammarPages, label: "grammar" },
    { value: language._count.scriptSymbols, label: "letters" },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          color: FG,
          fontFamily: "Gilroy, 'Noto Sans'",
          padding: "62px 70px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* aurora brand bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "12px",
            background: `linear-gradient(90deg, ${VIOLET}, ${PINK})`,
            display: "flex",
          }}
        />

        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "23px", fontWeight: 600, letterSpacing: "5px", color: fg(0.7), display: "flex" }}>
            LINGOCON
          </div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 700,
              letterSpacing: "3px",
              color: BG,
              background: VIOLET,
              borderRadius: "5px",
              padding: "9px 16px",
              display: "flex",
            }}
          >
            CONLANG
          </div>
        </div>

        {/* headword */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
          <div
            style={{
              fontSize: `${nameSize(language.name.length)}px`,
              fontWeight: 800,
              letterSpacing: "-3px",
              lineHeight: 1,
              display: "flex",
            }}
          >
            {language.name}
          </div>
          <div
            style={{
              fontFamily: "'Noto Sans'",
              fontStyle: "italic",
              fontSize: "30px",
              color: fg(0.55),
              marginTop: "20px",
              display: "flex",
            }}
          >
            a constructed language by {owner}
          </div>
          <div style={{ fontSize: "19px", fontWeight: 500, letterSpacing: "1px", color: VIOLET, marginTop: "14px", display: "flex" }}>
            lingocon.com/lang/{language.slug}
          </div>
        </div>

        {/* stat baseline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ height: "1px", background: BORDER, marginBottom: "22px", display: "flex" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: "48px" }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: "11px" }}>
                <span style={{ fontSize: "52px", fontWeight: 800, color: PINK }}>{s.value.toLocaleString()}</span>
                <span style={{ fontSize: "16px", fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase", color: fg(0.45) }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: loadOgFonts() },
  )
}
