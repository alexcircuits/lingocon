// @vitest-environment node
import { isValidElement, type ReactElement, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findLanguage: vi.fn(), findModules: vi.fn(), findModule: vi.fn(), findInstall: vi.fn(),
  installs: vi.fn(), canEditLanguage: vi.fn(), canEditScope: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    language: { findUnique: mocks.findLanguage },
    module: { findMany: mocks.findModules, findUnique: mocks.findModule },
    moduleInstall: { findFirst: mocks.findInstall },
  },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getUserId: async () => "me", canEditLanguage: mocks.canEditLanguage, canEditScope: mocks.canEditScope,
}))
vi.mock("@/lib/services/module", () => ({ getEnabledInstallsForUser: mocks.installs }))
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") } }))
vi.mock("@/components/modules/module-how-it-works", () => ({ ModuleHowItWorks: function ModuleHowItWorks() { return null } }))
vi.mock("@/components/modules/language-modules-manager", () => ({ LanguageModulesManager: function LanguageModulesManager() { return null } }))
vi.mock("@/components/modules/studio-recommended-modules", () => ({ StudioRecommendedModules: function StudioRecommendedModules() { return null } }))
vi.mock("@/components/modules/module-icon", () => ({ ModuleIcon: function ModuleIcon() { return null } }))
vi.mock("@/components/modules/declarative-transformer-panel", () => ({ DeclarativeTransformerPanel: function DeclarativeTransformerPanel() { return null } }))
vi.mock("@/components/modules/theme-preview-panel", () => ({ ThemePreviewPanel: function ThemePreviewPanel() { return null } }))
vi.mock("@/components/modules/module-frame", () => ({ ModuleFrame: function ModuleFrame() { return null } }))
vi.mock("@/components/modules/add-module-button", () => ({ AddModuleButton: function AddModuleButton() { return null } }))
import StudioModulesPage from "../page"
import StudioModulePanelPage from "../[moduleSlug]/page"
import { StudioRecommendedModules } from "@/components/modules/studio-recommended-modules"
import { LanguageModulesManager } from "@/components/modules/language-modules-manager"
import { AddModuleButton } from "@/components/modules/add-module-button"
import { DeclarativeTransformerPanel } from "@/components/modules/declarative-transformer-panel"

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement(node)) return []
  const element = node as ReactElement<Record<string, unknown>>
  return [element, ...elements(element.props.children as ReactNode)]
}
const has = (tree: ReactNode, type: unknown) => elements(tree).some((el) => el.type === type)
const grantManage = (manage: boolean) =>
  mocks.canEditScope.mockImplementation(async (_l: string, _u: string, scope: string) => scope === "manage:modules" && manage)
const transformer = {
  id: "mod-1", slug: "rules", name: "Rules", icon: null, type: "TRANSFORMER", tier: "DECLARATIVE", summary: null,
  status: "PUBLISHED", versions: [{ permissions: [], bundleCode: null, data: null }],
}
const panel = () => StudioModulePanelPage({ params: Promise.resolve({ slug: "lingua", moduleSlug: "rules" }) })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.findLanguage.mockResolvedValue({ id: "lang-1", slug: "lingua", name: "Lingua" })
  mocks.findModules.mockResolvedValue([])
  mocks.installs.mockResolvedValue([])
  mocks.findModule.mockResolvedValue(transformer)
  mocks.findInstall.mockResolvedValue(null)
  mocks.canEditLanguage.mockResolvedValue(true)
  grantManage(false)
})

describe("studio modules pages access", () => {
  it("offers no recommended-module adds to an editor without manage:modules, but keeps their own installs", async () => {
    const tree = await StudioModulesPage({ params: Promise.resolve({ slug: "lingua" }) })
    expect(has(tree, StudioRecommendedModules)).toBe(false)
    expect(has(tree, LanguageModulesManager)).toBe(true)
  })

  it("offers recommended modules with manage:modules", async () => {
    grantManage(true)
    expect(has(await StudioModulesPage({ params: Promise.resolve({ slug: "lingua" }) }), StudioRecommendedModules)).toBe(true)
  })

  it("offers adding a module from its panel page only with manage:modules", async () => {
    expect(has(await panel(), AddModuleButton)).toBe(false)
    grantManage(true)
    expect(has(await panel(), AddModuleButton)).toBe(true)
  })

  it("offers an installed rule pack's preview/apply panel only with manage:modules", async () => {
    mocks.findInstall.mockResolvedValue({
      id: "install-1", enabled: true, grantedPermissions: null, version: { data: null, bundleCode: null, permissions: [] },
    })
    expect(has(await panel(), DeclarativeTransformerPanel)).toBe(false)
    grantManage(true)
    expect(has(await panel(), DeclarativeTransformerPanel)).toBe(true)
  })
})
