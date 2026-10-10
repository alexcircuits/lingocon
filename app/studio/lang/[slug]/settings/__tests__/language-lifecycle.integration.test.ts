// @vitest-environment node
/**
 * REAL-DATABASE test: deleting a language or transferring its ownership refreshes every listing
 * that showed it. Skipped unless DATABASE_URL points at a disposable local
 * `lingocon_rewrite_test_*` database; uses only its own rows.
 */
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const testDb = vi.hoisted(() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "")
    const ok = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && /^\/lingocon_rewrite_test_\w+$/.test(url.pathname)
      && url.search === "" // ?host= etc. could point Prisma elsewhere
    if (ok) process.env.DEV_MODE = "false"
    return ok
  } catch {
    return false
  }
})
const actor = vi.hoisted(() => ({ id: null as string | null }))
vi.mock("@/auth", () => ({ auth: async () => (actor.id ? { user: { id: actor.id } } : null) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock("@/app/actions/badge", () => ({ checkLanguageBadges: vi.fn(async () => undefined) }))

import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { deleteLanguage } from "@/app/actions/language"
import { transferLanguageOwnership } from "@/app/actions/collaborator"

const prefix = `lifecycle-${randomUUID().slice(0, 8)}`
const owner = `${prefix}-owner`
const successor = `${prefix}-successor`
const stranger = `${prefix}-stranger`
const project = `${prefix}-project`
const paths = () => vi.mocked(revalidatePath).mock.calls.map((call) => call.filter(Boolean).join(" "))

describe.skipIf(!testDb)("language deletion and ownership transfer refresh listings (real Postgres)", () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [owner, successor, stranger].map((id) => ({ id, email: `${id}@example.test` })) })
    await prisma.language.create({ data: { id: project, slug: project, name: project, ownerId: owner, visibility: "PUBLIC" } })
  })
  beforeEach(() => {
    vi.mocked(revalidatePath).mockClear()
    vi.mocked(revalidateTag).mockClear()
  })
  afterAll(async () => {
    await prisma.language.deleteMany({ where: { id: project } })
    await prisma.user.deleteMany({ where: { id: { in: [owner, successor, stranger] } } })
    await prisma.$disconnect()
  })

  it("transferring ownership refreshes both dashboards and the project routes", async () => {
    actor.id = owner
    expect(await transferLanguageOwnership({ languageId: project, newOwnerId: successor })).toMatchObject({ success: true })
    expect((await prisma.language.findUniqueOrThrow({ where: { id: project } })).ownerId).toBe(successor)
    expect(paths()).toEqual(expect.arrayContaining([
      "/dashboard", "/studio", "/browse", `/studio/lang/${project} layout`, `/lang/${project} layout`,
    ]))
  })

  it("a rejected deletion changes nothing and refreshes nothing", async () => {
    actor.id = stranger
    expect(await deleteLanguage(project)).toHaveProperty("error")
    expect(await prisma.language.findUnique({ where: { id: project } })).not.toBeNull()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("deleting a language refreshes the dashboard, studio, browse, family and landing listings", async () => {
    actor.id = successor
    expect(await deleteLanguage(project)).toMatchObject({ success: true })
    expect(await prisma.language.findUnique({ where: { id: project } })).toBeNull()
    expect(paths()).toEqual(expect.arrayContaining([
      "/dashboard", "/studio", "/browse", "/families", "/dashboard/families",
      `/studio/lang/${project} layout`, `/lang/${project} layout`,
    ]))
    expect(revalidateTag).toHaveBeenCalledWith("languages")
  })
})
