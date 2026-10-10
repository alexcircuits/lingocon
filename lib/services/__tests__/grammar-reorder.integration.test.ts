// @vitest-environment node
/**
 * REAL-DATABASE test: reordering grammar pages must not change their revision.
 *
 * `updatedAt` is the optimistic-concurrency token of the page editor; a reorder in
 * one tab must not make an open editor in another tab report a false conflict.
 * Opt-in: runs only against a disposable local `lingocon_rewrite_test_*` database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

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

const owner = vi.hoisted(() => `reorder-owner-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`)
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: owner } }) }))

import { prisma } from "@/lib/prisma"
import { reorderPages } from "../grammar-page"

const suffix = owner.slice("reorder-owner-".length)
const project = `reorder-project-${suffix}`

describe.runIf(testDb)("grammar page reorder (real Postgres)", () => {
  beforeAll(async () => {
    await prisma.user.create({ data: { id: owner, email: `${owner}@example.test` } })
    await prisma.language.create({ data: { id: project, slug: project, name: project, ownerId: owner } })
    await prisma.grammarPage.createMany({ data: [
      { id: `${project}-a`, languageId: project, title: "A", slug: "a", content: {}, order: 0 },
      { id: `${project}-b`, languageId: project, title: "B", slug: "b", content: {}, order: 1 },
    ] })
  })

  afterAll(async () => {
    await prisma.language.deleteMany({ where: { id: project } })
    await prisma.user.deleteMany({ where: { id: owner } })
    await prisma.$disconnect()
  })

  it("swaps the order without touching either page's revision", async () => {
    const before = await prisma.grammarPage.findMany({ where: { languageId: project }, orderBy: { id: "asc" } })
    await new Promise((resolve) => setTimeout(resolve, 5)) // a bumped timestamp would differ
    await reorderPages(`${project}-b`, project, "up", owner)
    const after = await prisma.grammarPage.findMany({ where: { languageId: project }, orderBy: { id: "asc" } })
    expect(after.map((p) => p.order)).toEqual([1, 0])
    expect(after.map((p) => p.updatedAt.getTime())).toEqual(before.map((p) => p.updatedAt.getTime()))
  })
})
