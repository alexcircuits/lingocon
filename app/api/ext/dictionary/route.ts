import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { extractBearer, validateExtensionToken } from "@/lib/services/extension-token"
import { createHash } from "crypto"

export const dynamic = "force-dynamic"

const PAGE_LIMIT = 500

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
 * GET /api/ext/dictionary?languageId=X&page=1
 * Paginated dictionary entries with ETag + If-None-Match support.
 * Supports ?since=ISO8601 for incremental sync.
 */
export async function GET(request: NextRequest) {
  const raw = extractBearer(request.headers.get("Authorization"))
  const userId = raw ? await validateExtensionToken(raw) : null
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const languageId = params.get("languageId")
  if (!languageId) {
    return NextResponse.json({ error: "languageId is required" }, { status: 400 })
  }

  if (!(await canAccessLanguage(userId, languageId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const parsedPage = parseInt(params.get("page") ?? "1", 10)
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1
  const since = params.get("since")
  if (since && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "since must be an ISO 8601 timestamp" }, { status: 400 })
  }

  const where = {
    languageId,
    ...(since ? { updatedAt: { gt: new Date(since) } } : {}),
  }

  const [entries, total, maxUpdated] = await Promise.all([
    prisma.dictionaryEntry.findMany({
      where,
      select: {
        id: true,
        lemma: true,
        gloss: true,
        ipa: true,
        partOfSpeech: true,
        tags: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "asc" },
      skip: (page - 1) * PAGE_LIMIT,
      take: PAGE_LIMIT,
    }),
    prisma.dictionaryEntry.count({ where }),
    prisma.dictionaryEntry.aggregate({
      where: { languageId },
      _max: { updatedAt: true },
    }),
  ])

  const updatedAt = maxUpdated._max.updatedAt?.toISOString() ?? new Date(0).toISOString()
  // max(updatedAt) alone doesn't change when an entry is deleted, so clients kept getting 304 and
  // never dropped deleted words. The entry count and page make the tag change on deletes too.
  const etag = `"${createHash("sha256").update(`${languageId}:${updatedAt}:${total}:${page}`).digest("hex").slice(0, 16)}"`

  const ifNoneMatch = request.headers.get("If-None-Match")
  if (ifNoneMatch === etag && !since) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  return NextResponse.json(
    { entries, total, page, limit: PAGE_LIMIT, updatedAt },
    { headers: { ETag: etag } }
  )
}
