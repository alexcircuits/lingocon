// @vitest-environment node
import type { ReactElement, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findLanguage: vi.fn(), findLanguages: vi.fn(), findEntries: vi.fn(),
  canView: vi.fn(), isOwner: vi.fn(), canEdit: vi.fn(), tree: vi.fn(), families: vi.fn(), descendants: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    language: { findUnique: mocks.findLanguage, findMany: mocks.findLanguages },
    dictionaryEntry: { findMany: mocks.findEntries },
  },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getUserId: async () => "viewer", canViewLanguage: mocks.canView, isLanguageOwner: mocks.isOwner, canEditLanguage: mocks.canEdit,
}))
vi.mock("@/app/actions/language-family", () => ({ getLanguageFamilyTree: mocks.tree, getUserFamilies: mocks.families }))
vi.mock("@/lib/utils/family-graph", () => ({ getDescendantIds: mocks.descendants }))
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`) },
  notFound: () => { throw new Error("notFound") },
}))
vi.mock("../language-settings", () => ({ LanguageSettings: function LanguageSettings() { return null } }))
vi.mock("../parent-language-card", () => ({ ParentLanguageCard: function ParentLanguageCard() { return null } }))
vi.mock("../collaborators", () => ({
  Collaborators: function Collaborators() { return null },
  TransferOwnershipCard: function TransferOwnershipCard() { return null },
}))
import SettingsPage from "../page"
import { ParentLanguageCard } from "../parent-language-card"
import { LanguageSettings } from "../language-settings"
import { TransferOwnershipCard } from "../collaborators"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const tick = () => new Promise((done) => setTimeout(done, 0))
const language = {
  id: "project", slug: "project", name: "Project", ownerId: "viewer", metadata: null,
  parentLanguageId: null, parentLanguage: null, family: null, familyId: null, externalAncestry: null,
}
const independentReads = () => [mocks.tree]
// Reads for props the family card no longer uses (its pickers search through server actions).
const unusedReads = () => [mocks.findLanguages, mocks.descendants, mocks.families, mocks.findEntries]
function find(node: ReactNode, type: unknown): ReactElement | undefined {
  const element = node as ReactElement<{ children?: ReactNode }>
  if (!element || typeof element !== "object") return undefined
  if (element.type === type) return element
  for (const child of ([] as ReactNode[]).concat(element.props?.children ?? [])) {
    const found = find(child, type)
    if (found) return found
  }
}
const render = () => SettingsPage({ params: Promise.resolve({ slug: "project" }) })

beforeEach(() => {
  vi.resetAllMocks()
  process.env.DEV_MODE = "false"
  mocks.findLanguage.mockResolvedValue(language)
  mocks.canView.mockResolvedValue(true)
  mocks.findLanguages.mockResolvedValue([])
  mocks.descendants.mockResolvedValue([])
  mocks.families.mockResolvedValue([])
  mocks.canEdit.mockResolvedValue(true)
  mocks.isOwner.mockResolvedValue(true)
  mocks.tree.mockResolvedValue(null)
  mocks.findEntries.mockResolvedValue([])
})

describe("studio settings page data loading", () => {
  it("authorizes before reading anything else about the project", async () => {
    const view = deferred<boolean>()
    mocks.canView.mockReturnValue(view.promise)
    const page = render()
    await tick()
    for (const read of [...independentReads(), ...unusedReads()]) expect(read).not.toHaveBeenCalled()
    view.resolve(false)
    await expect(page).rejects.toThrow("notFound")
    for (const read of [...independentReads(), ...unusedReads()]) expect(read).not.toHaveBeenCalled()
  })

  it("starts the independent reads together once authorized, and never loads data no card renders", async () => {
    const gates = independentReads().map((read) => {
      const gate = deferred<unknown>()
      read.mockReturnValue(gate.promise)
      return gate
    })
    const page = render()
    await tick()
    for (const read of independentReads()) expect(read).toHaveBeenCalledTimes(1)
    gates.forEach((gate) => gate.resolve(null))
    const tree = await page
    expect(find(tree, ParentLanguageCard)?.props).toMatchObject({ isOwner: true, familyTree: null })
    for (const prop of ["families", "userLanguages", "descendantIds", "initialExternalAncestry"]) {
      expect(find(tree, ParentLanguageCard)?.props).not.toHaveProperty(prop)
    }
    expect(find(tree, TransferOwnershipCard)).toBeDefined()
    expect(find(tree, LanguageSettings)?.props).not.toHaveProperty("dictionaryEntries")
    for (const read of unusedReads()) expect(read).not.toHaveBeenCalled()
  })

  it("sends the settings form only its fields and the metadata key it edits", async () => {
    mocks.findLanguage.mockResolvedValue({
      ...language,
      metadata: { tts: { voiceId: "Hans", speed: "slow" }, soundChangeRules: "a > e", vowels: ["a", "e"] },
      parentLanguageId: "parent", parentLanguage: { id: "parent", name: "Parent", owner: { name: "Ada" } },
    })
    const tree = await render()
    const props = find(tree, LanguageSettings)?.props as { language: Record<string, unknown> }
    expect(props.language.metadata).toEqual({ tts: { voiceId: "Hans", speed: "slow" } })
    for (const key of ["ownerId", "parentLanguage", "parentLanguageId", "family", "familyId"]) {
      expect(props.language).not.toHaveProperty(key)
    }
    expect(find(tree, ParentLanguageCard)?.props).toMatchObject({
      currentParentId: "parent", initialParent: { id: "parent", name: "Parent", owner: { name: "Ada" } },
    })
  })

  it("still renders the settings when the family tree cannot be loaded", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.tree.mockRejectedValue(new Error("tree unavailable"))
    const tree = await render()
    expect(find(tree, ParentLanguageCard)?.props).toMatchObject({ familyTree: null })
    expect(find(tree, LanguageSettings)?.props).toMatchObject({ isOwner: true })
    error.mockRestore()
  })

  it("does not offer owner-only controls to a collaborator", async () => {
    mocks.findLanguage.mockResolvedValue({ ...language, ownerId: "someone-else" })
    mocks.isOwner.mockResolvedValue(false)
    const tree = await render()
    expect(find(tree, LanguageSettings)?.props).toMatchObject({ isOwner: false })
    expect(find(tree, TransferOwnershipCard)).toBeUndefined()
  })

  it("keeps the owner-only parent/family controls from an editor collaborator", async () => {
    // An editor passes canEditLanguage, but setting the parent or family is owner-only on the server.
    mocks.findLanguage.mockResolvedValue({ ...language, ownerId: "someone-else" })
    mocks.canEdit.mockResolvedValue(true)
    const tree = await render()
    expect(find(tree, ParentLanguageCard)?.props).toMatchObject({ isOwner: false })
  })
})
