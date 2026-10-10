import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-helpers"
import { getPlatformUpdates } from "@/app/actions/platform-update"
import { getRecentAchievements } from "@/app/actions/badge"
import { getNotifications, getUnreadNotificationCount } from "@/app/actions/notification"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "private, no-store" }

/**
 * Bell-menu data for the signed-in user.
 *
 * A GET route rather than Server Actions: the navbar mounts on most pages, and
 * Next 14 runs Server Actions one at a time per tab, so four read-only actions
 * per navigation queued in front of the user's real saves.
 */
export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ updates: [], achievements: [], notifications: [], unreadCount: 0 }, { headers: NO_STORE })
  }

  try {
    const [updatesResult, achievements, personalResult, unreadResult] = await Promise.all([
      getPlatformUpdates(5),
      getRecentAchievements(48),
      getNotifications(15),
      getUnreadNotificationCount(),
    ])

    return NextResponse.json(
      {
        updates: updatesResult.success ? updatesResult.data ?? [] : [],
        achievements,
        notifications: personalResult.data ?? [],
        unreadCount: unreadResult.count ?? 0,
      },
      { headers: NO_STORE }
    )
  } catch (error) {
    console.error("[GET /api/me/notifications]", error)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500, headers: NO_STORE })
  }
}
