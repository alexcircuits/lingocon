// @vitest-environment node
import type { ReactElement, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(), findLanguages: vi.fn(), countLanguages: vi.fn(), auth: vi.fn(),
  followCounts: vi.fn(), followers: vi.fn(), following: vi.fn(), badges: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    language: { findMany: mocks.findLanguages, count: mocks.countLanguages },
  },
}))
vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/app/actions/follow", () => ({ getFollowCounts: mocks.followCounts, getFollowers: mocks.followers, getFollowing: mocks.following }))
vi.mock("@/app/actions/badge", () => ({ getUserBadges: mocks.badges }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") } }))
vi.mock("@/components/navbar", () => ({ Navbar: function Navbar() { return null } }))
vi.mock("@/components/footer", () => ({ Footer: function Footer() { return null } }))
vi.mock("@/components/activity-feed", () => ({ ActivityFeed: function ActivityFeed() { return null } }))
vi.mock("@/components/badges/badge-grid", () => ({ BadgeGrid: function BadgeGrid() { return null } }))
vi.mock("@/components/profile/profile-cover", () => ({ ProfileCover: function ProfileCover() { return null } }))
vi.mock("@/components/profile/profile-sidebar", () => ({ ProfileSidebar: function ProfileSidebar() { return null } }))
vi.mock("@/components/profile/language-list", () => ({ LanguageList: function LanguageList() { return null } }))
vi.mock("@/components/back-button", () => ({ BackButton: function BackButton() { return null } }))
import UserProfilePage from "../page"
import { LanguageList } from "@/components/profile/language-list"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const tick = () => new Promise((done) => setTimeout(done, 0))
function find(node: ReactNode, type: unknown): ReactElement | undefined {
  const element = node as ReactElement<{ children?: ReactNode }>
  if (!element || typeof element !== "object") return undefined
  if (element.type === type) return element
  for (const child of ([] as ReactNode[]).concat(element.props?.children ?? [])) {
    const found = find(child, type)
    if (found) return found
  }
}
const render = () => UserProfilePage({ params: Promise.resolve({ userId: "user-1" }) })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: "viewer" } })
  mocks.findUser.mockResolvedValue({ id: "user-1", name: "Ada", image: null, createdAt: new Date("2026-01-01") })
  mocks.findLanguages.mockResolvedValue([])
  mocks.followCounts.mockResolvedValue({ success: true, followers: 0, following: 0 })
  mocks.followers.mockResolvedValue({ success: true, data: [] })
  mocks.following.mockResolvedValue({ success: true, data: [] })
  mocks.badges.mockResolvedValue([])
})

describe("public profile page data", () => {
  it("issues the profile's independent reads together", async () => {
    const gate = deferred<unknown[]>()
    mocks.findLanguages.mockReturnValue(gate.promise)
    const page = render()
    await tick()
    for (const read of [mocks.followCounts, mocks.followers, mocks.following, mocks.badges]) {
      expect(read).toHaveBeenCalledWith("user-1")
    }
    gate.resolve([])
    await page
  })

  it("sends the language cards only the fields they render", async () => {
    const card = {
      id: "l1", name: "Elvish", slug: "elvish", description: null, flagUrl: null, category: "CONLANG",
      createdAt: new Date(), owner: { id: "user-1", name: "Ada", image: null },
      _count: { scriptSymbols: 1, grammarPages: 2, dictionaryEntries: 3 },
    }
    mocks.findLanguages.mockResolvedValue([card])
    const tree = await render()

    const query = mocks.findLanguages.mock.calls[0][0]
    expect(query).not.toHaveProperty("include")
    expect(Object.keys(query.select).sort()).toEqual(
      ["_count", "category", "createdAt", "description", "flagUrl", "id", "name", "owner", "slug"]
    )
    expect(find(tree, LanguageList)?.props).toMatchObject({ languages: [card], isOwnProfile: false })
  })
})
