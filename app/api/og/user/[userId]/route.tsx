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
  if (len > 10) return 104
  return 124
}

/** Bold, brand-themed Open Graph card for a creator profile. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params

  const [user, languages, words, followers, badges] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.language.count({ where: { ownerId: userId, visibility: "PUBLIC" } }),
    prisma.dictionaryEntry.count({ where: { language: { ownerId: userId, visibility: "PUBLIC" } } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.userBadge.count({ where: { userId, earnedAt: { not: null } } }),
  ])

  if (!user) {
    return new Response("User not found", { status: 404 })
  }

  const name = user.name || "Conlang creator"
  const stats: { value: number; label: string }[] = [
    { value: languages, label: "languages" },
    { value: words, label: "words" },
    { value: followers, label: "followers" },
    { value: badges, label: "badges" },
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
            PROFILE
          </div>
        </div>

        {/* headword */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
          <div style={{ fontSize: `${nameSize(name.length)}px`, fontWeight: 800, letterSpacing: "-3px", lineHeight: 1, display: "flex" }}>
            {name}
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
            a creator of constructed languages
          </div>
        </div>

        {/* stat baseline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ height: "1px", background: BORDER, marginBottom: "22px", display: "flex" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: "44px" }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span style={{ fontSize: "50px", fontWeight: 800, color: PINK }}>{s.value.toLocaleString()}</span>
                <span style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: fg(0.45) }}>
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
