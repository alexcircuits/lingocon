import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getLanguageDictionary: vi.fn(),
  deriveWords: vi.fn(),
  router: { refresh: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock("@/app/actions/language-family", () => ({
  getLanguageDictionary: mocks.getLanguageDictionary,
  deriveWords: mocks.deriveWords,
}))
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }))
vi.mock("sonner", () => ({ toast: mocks.toast }))
vi.mock("next-intl", () => ({ useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}` }))

import { DerivationPanel } from "../derivation-panel"

const entry = (lemma: string) => ({ id: lemma, lemma, gloss: `${lemma} gloss`, ipa: null, partOfSpeech: null, tags: null })
const page = (...lemmas: string[]) => ({ entries: lemmas.map(entry), total: lemmas.length })
const props = {
  sourceLanguageId: "proto", sourceLanguageName: "Proto",
  targetLanguageId: "daughter", targetLanguageName: "Daughter", onClose: vi.fn(),
}
const spinner = (container: HTMLElement) => container.querySelector(".animate-spin")

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  // Drop queued once-implementations so one test's leftovers never leak into the next.
  mocks.getLanguageDictionary.mockReset()
  mocks.deriveWords.mockReset()
})

describe("derivation panel failure handling", () => {
  it("clears the loading spinner and explains when the word list cannot load, then retries", async () => {
    mocks.getLanguageDictionary.mockRejectedValueOnce(new Error("revoked")).mockResolvedValueOnce(page("recovered"))
    const { container } = render(<DerivationPanel {...props} />)
    await screen.findByText("families.deriveLoadFailed")
    expect(spinner(container)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "common.tryAgain" }))
    await screen.findByText("recovered")
    expect(screen.queryByText("families.deriveLoadFailed")).not.toBeInTheDocument()
  })

  it("ignores a slower response for an earlier search", async () => {
    let releaseFirst!: (value: ReturnType<typeof page>) => void
    mocks.getLanguageDictionary
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve }))
      .mockResolvedValueOnce(page("newer"))
    render(<DerivationPanel {...props} />)
    await waitFor(() => expect(mocks.getLanguageDictionary).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByPlaceholderText("Search words..."), { target: { value: "ne" } })
    await screen.findByText("newer")
    await act(async () => releaseFirst(page("stale")))
    expect(screen.queryByText("stale")).not.toBeInTheDocument()
    expect(screen.getByText("newer")).toBeInTheDocument()
  })

  it("reports a derive request that throws and lets the user try again", async () => {
    mocks.getLanguageDictionary.mockResolvedValue(page("word"))
    mocks.deriveWords.mockRejectedValueOnce(new Error("network down"))
    const { container } = render(<DerivationPanel {...props} />)
    fireEvent.click(await screen.findByText("word"))
    fireEvent.click(screen.getByRole("button", { name: /Derive 1 word/ }))
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("families.deriveFailed"))
    expect(spinner(container)).toBeNull()
    expect(screen.getByRole("button", { name: /Derive 1 word/ })).toBeEnabled()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it("refreshes the tree and closes after a successful derive", async () => {
    mocks.getLanguageDictionary.mockResolvedValue(page("word"))
    mocks.deriveWords.mockResolvedValueOnce({ success: true, data: { count: 1 } })
    render(<DerivationPanel {...props} />)
    fireEvent.click(await screen.findByText("word"))
    fireEvent.click(screen.getByRole("button", { name: /Derive 1 word/ }))
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    expect(mocks.router.refresh).toHaveBeenCalled()
  })
})
