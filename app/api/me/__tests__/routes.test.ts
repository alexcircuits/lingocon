import { beforeEach, describe, expect, it, vi } from "vitest"

const getUserId = vi.hoisted(() => vi.fn())
const getUnnotifiedBadges = vi.hoisted(() => vi.fn())
vi.mock("@/lib/auth-helpers", () => ({ getUserId }))
vi.mock("@/app/actions/badge-notifications", () => ({ getUnnotifiedBadges }))
vi.mock("@/app/actions/platform-update", () => ({ getPlatformUpdates: vi.fn().mockResolvedValue({ success: true, data: [{ id: "u1" }] }) }))
vi.mock("@/app/actions/badge", () => ({ getRecentAchievements: vi.fn().mockResolvedValue([{ id: "b1" }]) }))
vi.mock("@/app/actions/notification", () => ({
  getNotifications: vi.fn().mockResolvedValue({ data: [{ id: "n1" }] }),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ count: 3 }),
}))

import { GET as getBadges } from "@/app/api/me/badges/route"
import { GET as getBell } from "@/app/api/me/notifications/route"

describe("/api/me read routes", () => {
  beforeEach(() => {
    getUserId.mockReset()
    getUnnotifiedBadges.mockReset()
  })

  it("returns empty, uncacheable data to signed-out visitors without touching user data", async () => {
    getUserId.mockResolvedValue(null)
    const badges = await getBadges()
    expect(await badges.json()).toEqual({ badges: [] })
    expect(badges.headers.get("Cache-Control")).toBe("private, no-store")
    expect(getUnnotifiedBadges).not.toHaveBeenCalled()
    const bell = await getBell()
    expect(await bell.json()).toEqual({ updates: [], achievements: [], notifications: [], unreadCount: 0 })
  })

  it("returns the signed-in user's data with private no-store caching", async () => {
    getUserId.mockResolvedValue("user-1")
    getUnnotifiedBadges.mockResolvedValue([{ id: "badge" }])
    const badges = await getBadges()
    expect(await badges.json()).toEqual({ badges: [{ id: "badge" }] })
    expect(getUnnotifiedBadges).toHaveBeenCalledWith()
    const bell = await getBell()
    expect(bell.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await bell.json()).toEqual({ updates: [{ id: "u1" }], achievements: [{ id: "b1" }], notifications: [{ id: "n1" }], unreadCount: 3 })
  })

  it("reports a failure instead of an empty list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    getUserId.mockResolvedValue("user-1")
    getUnnotifiedBadges.mockRejectedValue(new Error("db down"))
    const badges = await getBadges()
    expect(badges.status).toBe(500)
  })
})
