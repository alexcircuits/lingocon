import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  save: vi.fn(), apply: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), batch: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock("@/app/actions/language", () => ({ updateLanguageMetadata: mocks.save }))
vi.mock("@/app/actions/apply-sound-changes", () => ({ applySoundChangesToDictionary: mocks.apply }))
vi.mock("@/lib/linguistics/use-sound-change-engine", () => ({
  useSoundChangeEngine: () => ({ source: "js", batchApply: mocks.batch }),
}))
vi.mock("@/components/ui/alert-dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>
  return {
    AlertDialog: Pass, AlertDialogTrigger: Pass, AlertDialogContent: Pass, AlertDialogHeader: Pass,
    AlertDialogTitle: Pass, AlertDialogDescription: Pass, AlertDialogFooter: Pass, AlertDialogCancel: () => null,
    AlertDialogAction: ({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) => (
      <button data-testid="confirm-apply" onClick={onClick} disabled={disabled}>confirm</button>
    ),
  }
})
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
import { SoundChangeEditor } from "../sound-change-editor"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const owner: Access = { isOwner: true, fullAccess: true, permissions: [] }
const entries = [{ id: "entry", lemma: "pa", gloss: "test", ipa: null }]
const phonology = { vowels: ["a"], consonants: ["t"] }
function editor(
  savedRules: string,
  inventory: { vowels: string[] | null; consonants: string[] | null } = phonology,
  access: Access = owner,
) {
  return (
    <StudioAccessProvider value={access}>
      <SoundChangeEditor languageId="project" languageName="Test" entries={entries} savedRules={savedRules} phonology={inventory} />
    </StudioAccessProvider>
  )
}
const textarea = () => document.querySelector("textarea")!
const applyButton = () => screen.getByRole("button", { name: /applyToDict/ })
const confirmApply = () => act(async () => { fireEvent.click(screen.getByTestId("confirm-apply")) })

beforeEach(() => {
  // Every word changes, so the preview always offers an application.
  mocks.batch.mockImplementation((words: string[]) => words.map((word) => ({ original: word, changed: `${word}!`, rulesApplied: [] })))
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe("applying reviewed sound changes", () => {
  it("previews with the phonology classes the server applies with", () => {
    render(editor("a > e"))
    const [, , vowels, consonants] = mocks.batch.mock.calls.at(-1)!
    expect(vowels).toEqual(new Set(["a"]))
    expect(consonants).toEqual(new Set(["t"]))
  })

  it("sends exactly the saved rules and phonology the preview used", async () => {
    mocks.apply.mockResolvedValue({ success: true, data: { applied: 1, unchanged: 0 } })
    render(editor("a > e"))
    await confirmApply()
    expect(mocks.apply).toHaveBeenCalledWith("project", { rules: "a > e", vowels: ["a"], consonants: ["t"] })
    expect(mocks.success).toHaveBeenCalledWith("appliedToast")
  })

  it("blocks applying an unsaved draft (the server applies the saved rules)", async () => {
    render(editor("a > e"))
    fireEvent.change(textarea(), { target: { value: "x > y" } })
    expect(applyButton()).toBeDisabled()
    expect(screen.getByText("applyNeedsSave")).toBeInTheDocument()
    await confirmApply()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("follows newer saved rules from the server when there is no unsaved draft", async () => {
    mocks.apply.mockResolvedValue({ success: true, data: { applied: 1, unchanged: 0 } })
    const view = render(editor("a > e"))
    view.rerender(editor("a > o"))
    expect(textarea()).toHaveValue("a > o")
    expect(applyButton()).toBeEnabled()
    await confirmApply()
    expect(mocks.apply).toHaveBeenCalledWith("project", { rules: "a > o", vowels: ["a"], consonants: ["t"] })
  })

  it("keeps an unsaved draft when newer saved rules arrive and keeps blocking the application", () => {
    const view = render(editor("a > e"))
    fireEvent.change(textarea(), { target: { value: "x > y" } })
    view.rerender(editor("s > h"))
    expect(textarea()).toHaveValue("x > y")
    expect(applyButton()).toBeDisabled()
  })

  it("can apply right after a successful save, before new server props arrive", async () => {
    mocks.save.mockResolvedValue({ success: true })
    mocks.apply.mockResolvedValue({ success: true, data: { applied: 1, unchanged: 0 } })
    render(editor("a > e"))
    fireEvent.change(textarea(), { target: { value: "a > i" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "save" })) })
    expect(mocks.save).toHaveBeenCalledWith("project", { soundChangeRules: "a > i" })
    expect(applyButton()).toBeEnabled()
    await confirmApply()
    expect(mocks.apply).toHaveBeenCalledWith("project", { rules: "a > i", vowels: ["a"], consonants: ["t"] })
  })

  it("explains a conflict instead of reporting success, and refreshes to the current rules", async () => {
    mocks.apply.mockResolvedValue({ error: "server message", code: "RULES_CHANGED" })
    render(editor("a > e"))
    await confirmApply()
    expect(screen.getByRole("alert")).toHaveTextContent("rulesChangedConflict")
    expect(mocks.error).toHaveBeenCalledWith("rulesChangedConflict")
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.refresh).toHaveBeenCalled()
    expect(textarea()).toHaveValue("a > e")
  })

  it("never acknowledges a rejected save", async () => {
    mocks.save.mockResolvedValue({ error: "Permission denied" })
    render(editor("a > e"))
    fireEvent.change(textarea(), { target: { value: "s > h" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "save" })) })
    expect(mocks.error).toHaveBeenCalledWith("Permission denied")
    expect(mocks.success).not.toHaveBeenCalled()
    expect(applyButton()).toBeDisabled()
  })

  it("runs only one application at a time", async () => {
    let finish!: (value: unknown) => void
    mocks.apply.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    render(editor("a > e"))
    fireEvent.click(screen.getByTestId("confirm-apply"))
    fireEvent.click(screen.getByTestId("confirm-apply"))
    expect(mocks.apply).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ success: true, data: { applied: 1, unchanged: 0 } }) })
  })
})

describe("sound change access", () => {
  const visitor = (permissions: string[]): Access => ({ isOwner: false, fullAccess: false, permissions })

  it("lets a read-only visitor preview the saved rules on test words without saving or applying", () => {
    render(editor("a > e", phonology, visitor([])))
    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /loadExample/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /applyToDict/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId("confirm-apply")).not.toBeInTheDocument()
    expect(textarea()).toHaveAttribute("readonly")
    fireEvent.change(screen.getByPlaceholderText("testWordsPlaceholder"), { target: { value: "tata" } })
    expect(screen.getByText("tata!")).toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it("offers saving rules, but not applying them, with only the phonology scope", () => {
    render(editor("a > e", phonology, visitor(["write:phonology"])))
    expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument()
    expect(textarea()).not.toHaveAttribute("readonly")
    expect(screen.queryByRole("button", { name: /applyToDict/ })).not.toBeInTheDocument()
  })

  it("offers applying the saved rules, but not editing them, with only the dictionary scope", async () => {
    mocks.apply.mockResolvedValue({ success: true, data: { applied: 1, unchanged: 0 } })
    render(editor("a > e", phonology, visitor(["write:dictionary"])))
    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument()
    expect(textarea()).toHaveAttribute("readonly")
    expect(applyButton()).toBeEnabled()
    await confirmApply()
    expect(mocks.apply).toHaveBeenCalledWith("project", { rules: "a > e", vowels: ["a"], consonants: ["t"] })
  })
})
