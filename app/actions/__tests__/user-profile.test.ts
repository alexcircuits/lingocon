// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
  getUserId: vi.fn(),
  refreshSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: mocks.userUpdate } } }))
vi.mock("@/lib/auth-helpers", () => ({ getUserId: mocks.getUserId }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/auth", () => ({ signOut: vi.fn(), unstable_update: mocks.refreshSession }))

import { updateUser } from "../user"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserId.mockResolvedValue("user-1")
  mocks.userUpdate.mockResolvedValue({ id: "user-1", name: "After Rename", image: null })
  mocks.refreshSession.mockResolvedValue({ user: { id: "user-1", name: "After Rename" } })
})

describe("updateUser", () => {
  it("re-issues the session cookie with the saved profile in the same response", async () => {
    // The name and avatar live in the JWT: without this, a reload right after saving
    // still showed the old name until the client's own session update landed.
    await expect(updateUser({ name: "After Rename", image: "" })).resolves.toMatchObject({ success: true })
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
    expect(mocks.userUpdate.mock.invocationCallOrder[0]).toBeLessThan(mocks.refreshSession.mock.invocationCallOrder[0])
  })

  it("still reports the save when the session refresh fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.refreshSession.mockRejectedValue(new Error("no session cookie"))
    await expect(updateUser({ name: "After Rename", image: "" })).resolves.toMatchObject({ success: true })
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it("does not touch the session when the save is rejected", async () => {
    mocks.getUserId.mockResolvedValue(null)
    await expect(updateUser({ name: "After Rename", image: "" })).resolves.toEqual({ error: "Unauthorized" })
    expect(mocks.refreshSession).not.toHaveBeenCalled()
  })
})
