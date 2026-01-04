import { NextRequest, NextResponse } from "next/server"
import { search, SearchScope } from "@/lib/services/search"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")?.trim() || ""
    const scope = (searchParams.get("scope") as SearchScope) || "all"

    const results = await search(query, scope)

    return NextResponse.json(results)
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      {
        languages: [],
        entries: [],
        grammarPages: [],
        error: "Search failed",
      },
      { status: 500 }
    )
  }
}
