// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Session } from "next-auth"
import type { JWT } from "next-auth/jwt"

const findUnique = vi.hoisted(() => vi.fn())
vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn(), unstable_update: vi.fn() }),
  CredentialsSignin: class extends Error {},
}))
vi.mock("next-auth/providers/github", () => ({ default: () => ({ id: "github" }) }))
vi.mock("next-auth/providers/google", () => ({ default: () => ({ id: "google" }) }))
vi.mock("next-auth/providers/credentials", () => ({ default: () => ({ id: "credentials" }) }))
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }))
vi.mock("@/lib/dev-auth", () => ({ getDevUserId: vi.fn() }))
vi.mock("@/lib/suspension", () => ({ isUserSuspended: vi.fn(async () => false) }))

import { nextAuthConfig } from "@/auth"

const { jwt, session } = nextAuthConfig.callbacks
// What Auth.js builds before our session callback: the picture comes from `token.picture`.
const baseSession = (token: JWT): Session => ({
  user: { name: token.name, email: "a@example.test", image: (token.picture as string | null) ?? null },
  expires: "2099-01-01T00:00:00.000Z",
})

beforeEach(() => findUnique.mockReset())

describe("session profile after an update", () => {
  it("drops a removed avatar instead of keeping the sign-in picture", async () => {
    // Signed in with an avatar (OAuth sets token.picture), then removed it in settings.
    const token = await jwt({ token: { picture: "old.png" } as JWT, user: { id: "u1", name: "Ana", image: "old.png" } })
    findUnique.mockResolvedValue({ name: "Ana", image: null })
    const updated = await jwt({ token, trigger: "update" })
    const result = await session({ session: baseSession(updated), token: updated })
    expect(result.user.image).toBeNull()
  })

  it("shows a new avatar and name after an update", async () => {
    const token = await jwt({ token: {} as JWT, user: { id: "u1", name: "Ana", image: null } })
    findUnique.mockResolvedValue({ name: "Ana B", image: "new.png" })
    const updated = await jwt({ token, trigger: "update" })
    const result = await session({ session: baseSession(updated), token: updated })
    expect(result.user).toMatchObject({ id: "u1", name: "Ana B", image: "new.png" })
  })

  it("keeps the picture of a token issued before `image` was tracked", async () => {
    const token = { id: "u1", name: "Ana", picture: "old.png" } as JWT
    const result = await session({ session: baseSession(token), token })
    expect(result.user.image).toBe("old.png")
  })
})
