import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/app/actions/paradigm", () => ({
  createParadigm: vi.fn(), updateParadigm: vi.fn(), deleteParadigm: vi.fn(), cloneParadigm: vi.fn(),
}))
vi.mock("@/components/ipa-speaker", () => ({ IPASpeaker: () => null }))
vi.mock("../paradigm-inflection-dialog", () => ({ ParadigmInflectionDialog: () => null }))
vi.mock("../paradigm-content-editor", () => ({ ParadigmContentEditor: () => null }))
import { ParadigmManager } from "../paradigm-manager"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const readOnly: Access = { isOwner: false, fullAccess: false, permissions: [] }
const paradigmEditor: Access = { isOwner: false, fullAccess: false, permissions: ["write:paradigms"] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }

const paradigm = {
  id: "par-1", name: "Present tense", notes: null, languageId: "lang-1",
  slots: { rows: ["1sg", "2sg"], columns: ["form"], cells: { "0-0": "amo", "1-0": "amas" } },
  createdAt: new Date(), updatedAt: new Date(),
}
const cardControls = ["editContent", "Auto-inflection rules", "editStructure", "duplicateParadigm", "deleteParadigm"]

afterEach(cleanup)

describe("paradigm manager access", () => {
  it("shows a read-only visitor the tables without add, edit, duplicate or delete controls", () => {
    render(<ParadigmManager languageId="lang-1" paradigms={[paradigm]} />, { wrapper: withAccess(readOnly) })
    expect(screen.getByText("Present tense")).toBeInTheDocument()
    expect(screen.getByText("amas")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "addParadigm" })).not.toBeInTheDocument()
    for (const name of cardControls) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
  })

  it("has no add call to action in the empty state for a read-only visitor", () => {
    render(<ParadigmManager languageId="lang-1" paradigms={[]} />, { wrapper: withAccess(readOnly) })
    expect(screen.getByText("emptyTitle")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "addParadigm" })).not.toBeInTheDocument()
  })

  it("offers every control to a collaborator with the paradigm scope", () => {
    render(<ParadigmManager languageId="lang-1" paradigms={[paradigm]} />, { wrapper: withAccess(paradigmEditor) })
    expect(screen.getByRole("button", { name: "addParadigm" })).toBeInTheDocument()
    for (const name of cardControls) expect(screen.getByRole("button", { name })).toBeInTheDocument()
  })
})
