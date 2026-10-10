import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ symbolRenders: 0, create: vi.fn(), update: vi.fn() }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/app/actions/script-symbol", () => ({
  createScriptSymbol: mocks.create, updateScriptSymbol: mocks.update,
  deleteScriptSymbol: vi.fn(), saveAlphabetOrder: vi.fn(),
}))
vi.mock("@/components/ui/ipa-input", () => ({
  IPAInput: ({ id, value, onChange }: { id?: string; value?: string; onChange?: (value: string) => void }) => (
    <input id={id} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} />
  ),
}))
// Counts renders of the (dnd-kit sortable) symbol cards; a read-only card offers no edit control.
vi.mock("../sortable-symbol", () => ({
  SortableSymbol: ({ symbol, onEdit, readOnly }: { symbol: { symbol: string }; onEdit: (symbol: unknown) => void; readOnly?: boolean }) => {
    mocks.symbolRenders++
    return readOnly
      ? <span>symbol {symbol.symbol}</span>
      : <button type="button" onClick={() => onEdit(symbol)}>edit {symbol.symbol}</button>
  },
}))
import { AlphabetManager, type ScriptSymbol } from "../alphabet-manager"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const owner: Access = { isOwner: true, fullAccess: true, permissions: [] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }

const symbols: ScriptSymbol[] = ["a", "b", "c", "d", "e", "f", "g", "h"].map((symbol, order) => ({
  id: `s-${symbol}`, symbol, capitalSymbol: symbol.toUpperCase(), ipa: symbol, latin: symbol, name: null, order,
  languageId: "lang-1", createdAt: new Date(), updatedAt: new Date(),
}))
const type = (id: string, value: string) => act(() => { fireEvent.change(document.getElementById(id)!, { target: { value } }) })
const renderManager = (access: Access = owner, list: ScriptSymbol[] = symbols) =>
  render(<AlphabetManager languageId="lang-1" symbols={list} />, { wrapper: withAccess(access) })

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
beforeEach(() => { mocks.symbolRenders = 0; vi.clearAllMocks() })

describe("alphabet manager typing cost", () => {
  it("does not re-render the sortable symbol grid on each keystroke in the add form", async () => {
    renderManager()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "addSymbol" })) })
    const before = mocks.symbolRenders

    for (const value of ["t", "th", "thr"]) await type("add-symbol", value)
    await type("add-latin", "thr")

    expect(mocks.symbolRenders).toBe(before)
    expect(document.getElementById("add-symbol")).toHaveValue("thr")
  })

  it("still edits the symbol that was picked, with its current values", async () => {
    mocks.update.mockResolvedValue({ data: {} })
    renderManager()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "edit c" })) })
    expect(document.getElementById("edit-symbol")).toHaveValue("c")
    expect(document.getElementById("edit-capital")).toHaveValue("C")

    await type("edit-symbol", "ç")
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "updateSymbol" })) })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ id: "s-c", symbol: "ç", capitalSymbol: "C", order: 2 }))
  })
})

describe("alphabet manager access", () => {
  const readOnly: Access = { isOwner: false, fullAccess: false, permissions: [] }

  it("shows a read-only visitor the symbols without add, edit, move or delete controls", () => {
    renderManager(readOnly)
    expect(screen.queryByRole("button", { name: "addSymbol" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^edit / })).not.toBeInTheDocument()
    expect(screen.getByText("symbol c")).toBeInTheDocument()
  })

  it("has no add call to action in the empty state for a read-only visitor", () => {
    renderManager(readOnly, [])
    expect(screen.getByText("emptyTitle")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "addSymbol" })).not.toBeInTheDocument()
  })

  it("offers adding and editing to a collaborator with the alphabet scope", () => {
    renderManager({ isOwner: false, fullAccess: false, permissions: ["write:alphabet"] })
    expect(screen.getByRole("button", { name: "addSymbol" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "edit c" })).toBeInTheDocument()
  })
})
