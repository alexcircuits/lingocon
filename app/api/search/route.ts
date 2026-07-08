import { NextRequest, NextResponse } from "next/server"
import { searchFts } from "@/lib/services/search-fts"
import { SearchScope } from "@/lib/services/search"

export const dynamic = "force-dynamic"

const VALID_SCOPES: readonly SearchScope[] = [
  "all",
  "languages",
  "dictionary",
  "grammar",
  "articles",
  "texts",
]

// Cap query length so a pathologically long term can't push needless work into
// websearch_to_tsquery / similarity(). Real searches are far shorter.
const MAX_QUERY_LENGTH = 200

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = (searchParams.get("q")?.trim() || "").slice(0, MAX_QUERY_LENGTH)

    // Validate scope explicitly rather than blindly casting: an unrecognized
    // value would otherwise fall through and silently return empty results.
    const rawScope = searchParams.get("scope")
    if (rawScope !== null && !VALID_SCOPES.includes(rawScope as SearchScope)) {
      return NextResponse.json(
        { error: `Invalid scope. Expected one of: ${VALID_SCOPES.join(", ")}` },
        { status: 400 },
      )
    }
    const scope: SearchScope = (rawScope as SearchScope) || "all"

    const results = await searchFts(query, scope)

    return NextResponse.json(results)
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      {
        languages: [],
        entries: [],
        grammarPages: [],
        articles: [],
        texts: [],
        error: "Search failed",
      },
      { status: 500 }
    )
  }
}
