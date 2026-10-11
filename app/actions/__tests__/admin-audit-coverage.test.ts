// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const requireAdmin = vi.hoisted(() => vi.fn())
const logAdminAction = vi.hoisted(() => vi.fn())
const prisma = vi.hoisted(() => ({
  platformUpdate: { create: vi.fn(), delete: vi.fn() },
  session: { deleteMany: vi.fn() },
  verificationToken: { deleteMany: vi.fn() },
  user: { update: vi.fn() },
}))
vi.mock("@/lib/admin", () => ({ requireAdmin }))
vi.mock("@/lib/admin-audit", () => ({ logAdminAction }))
vi.mock("@/lib/prisma", () => ({ prisma }))

import * as mutations from "../admin-mutations"
import { toggleUserAdmin } from "../admin-users"

describe("every admin mutation leaves an audit record", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue(undefined)
  })

  it("publishing a platform update", async () => {
    prisma.platformUpdate.create.mockResolvedValue({ id: "u1", title: "New lessons" })
    await mutations.createPlatformUpdate({ title: "New lessons", description: "Courses are here" })
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "CREATE_PLATFORM_UPDATE", resource: "PLATFORM_UPDATE", resourceId: "u1" }))
  })

  it("deleting a platform update", async () => {
    prisma.platformUpdate.delete.mockResolvedValue({ id: "u1", title: "New lessons" })
    await mutations.deletePlatformUpdate("u1")
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "DELETE_PLATFORM_UPDATE", resource: "PLATFORM_UPDATE", resourceId: "u1" }))
  })

  it("pruning expired sessions", async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 2 })
    prisma.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
    await mutations.pruneSessions()
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "PRUNE_SESSIONS", resource: "SYSTEM", details: { sessions: 2, tokens: 1 } }))
  })

  it("granting admin rights goes through the audited action only", async () => {
    expect("toggleUserAdmin" in mutations).toBe(false)
    prisma.user.update.mockResolvedValue({ id: "user-1", email: "a@example.test", isAdmin: true })
    await toggleUserAdmin("user-1", true)
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "GRANT_ADMIN", resourceId: "user-1" }))
  })

  it("rejects a malformed role change before touching the database", async () => {
    await expect(toggleUserAdmin("", true)).rejects.toThrow()
    await expect(toggleUserAdmin("user-1", "yes" as unknown as boolean)).rejects.toThrow()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
