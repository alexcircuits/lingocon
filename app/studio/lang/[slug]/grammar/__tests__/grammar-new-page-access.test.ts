// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ findLanguage: vi.fn(), canEditScope: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { language: { findUnique: mocks.findLanguage } } }))
vi.mock("@/lib/auth-helpers", () => ({ getUserId: async () => "me", canEditScope: mocks.canEditScope }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`) },
  notFound: () => { throw new Error("notFound") },
}))
vi.mock("../grammar-editor", () => ({ GrammarEditor: function GrammarEditor() { return null } }))
import NewGrammarPage from "../new/page"

const open = () => NewGrammarPage({ params: Promise.resolve({ slug: "lingua" }) })

beforeEach(() => {
  vi.resetAllMocks()
  process.env.DEV_MODE = "false"
  mocks.findLanguage.mockResolvedValue({
    id: "lang-1", name: "Lingua", slug: "lingua", ownerId: "owner", scriptSymbols: [], grammarPages: [],
  })
})

describe("new grammar page access", () => {
  it("does not offer the create form to a visitor without write:grammar", async () => {
    mocks.canEditScope.mockResolvedValue(false)
    await expect(open()).rejects.toThrow("notFound")
    expect(mocks.canEditScope).toHaveBeenCalledWith("lang-1", "me", "write:grammar")
  })

  it("offers the create form with write:grammar", async () => {
    mocks.canEditScope.mockResolvedValue(true)
    await expect(open()).resolves.toBeTruthy()
  })
})
