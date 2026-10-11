import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const lemmas = vi.hoisted(() => ({ resolve: (_: string[]) => {}, reject: (_: Error) => {} }))
vi.mock("@/app/actions/dictionary-entry", () => ({
  getLanguageLemmas: vi.fn(
    () => new Promise<string[]>((resolve, reject) => Object.assign(lemmas, { resolve, reject }))
  ),
}))
vi.mock("next-intl", () => {
  const t = (key: string) => key
  return { useTranslations: () => t }
})
vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }))
import { WordGeneratorDialog } from "../word-generator-dialog"

// Radix ScrollArea measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver

// Two consonants and one vowel, one syllable: only "ka" and "na" can be generated.
const symbols = [
  { id: "k", symbol: "k", ipa: "k" },
  { id: "n", symbol: "n", ipa: "n" },
  { id: "a", symbol: "a", ipa: "a" },
] as never[]

function open() {
  render(
    <WordGeneratorDialog open onOpenChange={() => {}} symbols={symbols} metadata={{ syllableStructure: "CV" }} languageId="lang-1" onAddWord={() => {}} />
  )
}
const generate = () => screen.getByRole("button", { name: /generate|regenerate/i })
const words = () => Array.from(document.querySelectorAll("span.font-mono")).map((el) => el.textContent)

afterEach(() => cleanup())

describe("word generator dedupe", () => {
  it("waits for the language's words before generating, then never proposes one of them", async () => {
    open()
    // Under load the lemma list can take a while; generating before it arrives proposed existing words.
    expect(generate()).toBeDisabled()
    await act(async () => lemmas.resolve(["ka"]))
    expect(generate()).toBeEnabled()
    fireEvent.click(generate())
    expect(words().length).toBeGreaterThan(0)
    expect(words()).not.toContain("ka")
  })

  it("still lets you generate when the word list cannot be loaded", async () => {
    open()
    await act(async () => lemmas.reject(new Error("offline")))
    expect(generate()).toBeEnabled()
  })
})
