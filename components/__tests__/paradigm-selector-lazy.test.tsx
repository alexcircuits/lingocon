import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ paradigms: vi.fn() }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@/app/actions/paradigm", () => ({ getParadigmsForLanguage: mocks.paradigms }))
import { ParadigmSelector } from "@/components/paradigm-selector"

// Warm the selector module so the boundary resolves well within findBy's timeout.
beforeAll(async () => { await import("@/components/paradigm-selector-field") }, 30_000)

describe("code-split paradigm selector", () => {
  it("shows its loading state until its code and the paradigms have loaded, then the picker", async () => {
    mocks.paradigms.mockResolvedValue({ data: [{ id: "p1", name: "Nouns", notes: null }] })
    render(<ParadigmSelector languageId="lang-1" value="p1" onValueChange={() => undefined} />)

    expect(screen.getByText("loadingParadigms")).toBeInTheDocument()
    expect(await screen.findByRole("combobox")).toHaveTextContent("Nouns")
    expect(screen.queryByText("loadingParadigms")).not.toBeInTheDocument()
    expect(mocks.paradigms).toHaveBeenCalledWith("lang-1")
  })
})
