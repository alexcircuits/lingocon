// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const isAdmin = vi.hoisted(() => vi.fn())
const logAdminAction = vi.hoisted(() => vi.fn())
const findMany = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin", () => ({ isAdmin }))
vi.mock("@/lib/admin-audit", () => ({ logAdminAction }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany } } }))

import { GET } from "@/app/api/admin/export/users/route"

describe("GET /api/admin/export/users", () => {
  beforeEach(() => vi.clearAllMocks())

  it("refuses anyone but an admin with 403, not a server error", async () => {
    isAdmin.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(403)
    expect(findMany).not.toHaveBeenCalled()
  })

  it("refuses to export when the export cannot be audited", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    isAdmin.mockResolvedValue(true)
    logAdminAction.mockResolvedValue(false)
    findMany.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(500)
    expect(res.headers.get("Content-Type")).not.toContain("text/csv")
  })

  it("exports the users as uncached CSV and records who exported them", async () => {
    isAdmin.mockResolvedValue(true)
    logAdminAction.mockResolvedValue(true)
    findMany.mockResolvedValue([
      { id: "u1", name: "=HYPERLINK(1)", email: "a@example.test", isAdmin: false, createdAt: new Date("2026-10-01T10:00:00Z"), _count: { languages: 1, activities: 2, articles: 0, texts: 0 } },
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    const csv = await res.text()
    expect(csv.split("\n")[1]).toContain("'=HYPERLINK(1)")
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "EXPORT_USERS", resource: "USER", details: { count: 1 } }))
  })
})
