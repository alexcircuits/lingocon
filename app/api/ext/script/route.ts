import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { extractBearer, validateExtensionToken } from "@/lib/services/extension-token"
import { createHash } from "crypto"

export const dynamic = "force-dynamic"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

async function canAccessLanguage(userId: string, languageId: string): Promise<boolean> {
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: {
      ownerId: true,
      collaborators: { where: { userId }, select: { userId: true } },
    },
  })
  if (!language) return false
  return language.ownerId === userId || language.collaborators.length > 0
}

/**
 * GET /api/ext/script?languageId=X
 * Returns all ScriptSymbol rows for a language with ETag support.
 */
export async function GET(request: NextRequest) {
  const raw = extractBearer(request.headers.get("Authorization"))
  const userId = raw ? await validateExtensionToken(raw) : null
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const languageId = request.nextUrl.searchParams.get("languageId")
  if (!languageId) {
    return NextResponse.json({ error: "languageId is required" }, { status: 400 })
  }

  if (!(await canAccessLanguage(userId, languageId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const [symbols, maxUpdated] = await Promise.all([
    prisma.scriptSymbol.findMany({
      where: { languageId },
      select: { id: true, symbol: true, capitalSymbol: true, ipa: true, latin: true, order: true },
      orderBy: { order: "asc" },
    }),
    prisma.scriptSymbol.aggregate({
      where: { languageId },
      _max: { updatedAt: true },
    }),
  ])

  const updatedAt = maxUpdated._max.updatedAt?.toISOString() ?? new Date(0).toISOString()
  // Include the symbol count so deleting a symbol changes the tag (max(updatedAt) doesn't).
  const etag = `"${createHash("sha256").update(`script:${languageId}:${updatedAt}:${symbols.length}`).digest("hex").slice(0, 16)}"`

  if (request.headers.get("If-None-Match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  return NextResponse.json({ symbols }, { headers: { ETag: etag } })
}
