import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { getUnnotifiedBadges } from "@/app/actions/badge-notifications"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "private, no-store" }

/**
 * Earned badges the signed-in user has not been shown yet.
 *
 * Polled after navigations, so it must not be a Server Action: Next (14, 15) runs
 * those one at a time per tab, and a navigation that interrupts one forces an
 * extra full-tree refresh afterwards.
 */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ badges: [] }, { headers: NO_STORE })

  try {
    const badges = await getUnnotifiedBadges()
    return NextResponse.json({ badges }, { headers: NO_STORE })
  } catch (error) {
    console.error("[GET /api/me/badges]", error)
    return NextResponse.json({ error: "Failed to load badges" }, { status: 500, headers: NO_STORE })
  }
}
