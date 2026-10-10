import { act, cleanup, render, screen } from "@testing-library/react"
import { Suspense, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("next-intl", () => {
  // Stable like next-intl's own `t`: the page's load effect depends on it.
  const t = (key: string) => key
  return { useTranslations: () => t }
})
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// A two-string catalogue instead of every message in the app.
vi.mock("@/messages/en.json", () => ({ default: { common: { save: "Save", cancel: "Cancel" } } }))
import TranslatePage from "../page"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }
const visitor = (permissions: string[]): Access => ({ isOwner: false, fullAccess: false, permissions })

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (url.includes("language-by-slug") ? { id: "lang-1" } : { "common.save": "Sava" }),
  })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function open(access: Access) {
  // Next 15 passes params as a Promise; the page unwraps it with use(), which suspends.
  await act(async () => {
    render(
      <Suspense fallback={null}><TranslatePage params={Promise.resolve({ slug: "lingua" })} /></Suspense>,
      { wrapper: withAccess(access) }
    )
  })
  return screen.findByPlaceholderText("Save")
}

describe("translation editor access", () => {
  it("shows a read-only visitor the translations without a save control", async () => {
    const field = await open(visitor([]))
    expect(field).toHaveValue("Sava")
    expect(field).toHaveAttribute("readonly")
    expect(screen.queryByRole("button", { name: /saveTranslation/ })).not.toBeInTheDocument()
  })

  it("lets any collaborator with a write scope translate and save", async () => {
    const field = await open(visitor(["write:grammar"]))
    expect(field).not.toHaveAttribute("readonly")
    expect(screen.getByRole("button", { name: /saveTranslation/ })).toBeInTheDocument()
  })
})
