import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ phonotactics: vi.fn(), alphabet: vi.fn() }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/app/actions/paradigm", () => ({ getParadigmsForLanguage: vi.fn(async () => ({ data: [] })) }))
vi.mock("@/components/audio-recorder", () => ({ AudioRecorder: () => null }))
vi.mock("@/components/ui/ipa-input", () => ({
  IPAInput: ({ id, value, onChange }: { id?: string; value?: string; onChange?: (value: string) => void }) => (
    <input id={id} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} />
  ),
}))
// Spy on the validators while keeping their real results.
vi.mock("@/lib/utils/alphabet-validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/alphabet-validation")>()
  mocks.phonotactics.mockImplementation(actual.validatePhonotactics)
  mocks.alphabet.mockImplementation(actual.validateStringAgainstAlphabet)
  return { ...actual, validatePhonotactics: mocks.phonotactics, validateStringAgainstAlphabet: mocks.alphabet }
})
import { DictionaryEntryDialog } from "../dictionary-entry-dialog"

const symbols = ["p", "t", "k", "a", "i"].map((symbol, i) => ({
  id: `s${i}`, symbol, capitalSymbol: symbol.toUpperCase(), ipa: symbol, latin: symbol, name: symbol, order: i,
  languageId: "lang-1", createdAt: new Date(), updatedAt: new Date(),
})) as never
const metadata = { syllableStructure: "(C)V(C)", consonants: ["p", "t", "k"], vowels: ["a", "i"] }

function renderDialog() {
  render(
    <DictionaryEntryDialog open onOpenChange={() => undefined} onSubmit={async () => undefined} mode="create"
      symbols={symbols} metadata={metadata} languageId="lang-1" />
  )
}
const type = (id: string, value: string) => act(() => { fireEvent.change(document.getElementById(id)!, { target: { value } }) })

// Radix measures some controls; jsdom has no ResizeObserver.
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
beforeEach(() => { mocks.phonotactics.mockClear(); mocks.alphabet.mockClear() })

describe("dictionary entry dialog validation", () => {
  it("does not re-run the lemma validators while other fields are typed in", async () => {
    renderDialog()
    await type("lemma", "pataki")
    await waitFor(() => expect(mocks.phonotactics).toHaveBeenLastCalledWith("pataki", "(C)V(C)", ["p", "t", "k"], ["a", "i"]))
    mocks.phonotactics.mockClear()
    mocks.alphabet.mockClear()

    for (const value of ["a", "a d", "a de", "a def", "a defi", "a defin", "a defini", "a definit", "a definiti", "a definition"]) {
      await type("gloss", value)
    }
    await type("notes", "loanword")

    expect(mocks.phonotactics).not.toHaveBeenCalled()
    expect(mocks.alphabet).not.toHaveBeenCalled()
  })

  it("still flags a lemma that breaks the alphabet or the syllable structure", async () => {
    renderDialog()
    await type("lemma", "pxa")
    expect(await screen.findByText(/x/, { selector: "span" })).toBeInTheDocument()

    await type("lemma", "ppta")
    expect(await screen.findByText("(C)V(C)")).toBeInTheDocument()

    await type("lemma", "pata")
    await waitFor(() => expect(screen.queryByText("(C)V(C)")).not.toBeInTheDocument())
  })
})
