import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ saveMetadata: vi.fn(), updateLanguage: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock("@/app/actions/language", () => ({ updateLanguageMetadata: mocks.saveMetadata, updateLanguage: mocks.updateLanguage }))
vi.mock("@/components/ipa-keyboard", () => ({ IPAKeyboard: () => null }))
import { PhonologyView } from "../phonology-view"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const owner: Access = { isOwner: true, fullAccess: true, permissions: [] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe("phonology save", () => {
  it("sends only the phonology keys as a metadata patch", async () => {
    mocks.saveMetadata.mockResolvedValue({ success: true })
    render(
      <PhonologyView
        languageId="project"
        symbolIpas={["p", "a"]}
        metadata={{ syllableStructure: "CV", allophonyRules: "", phonologyOverride: { enabled: true, consonants: ["t"], vowels: ["a"] } }}
      />,
      { wrapper: withAccess(owner) }
    )
    fireEvent.change(screen.getByLabelText("syllableTemplate"), { target: { value: "CVC" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /savePhonology/ })) })
    expect(mocks.updateLanguage).not.toHaveBeenCalled()
    expect(mocks.saveMetadata).toHaveBeenCalledWith("project", {
      syllableStructure: "CVC", allophonyRules: "", phonologyOverride: { enabled: true, consonants: ["t"], vowels: ["a"] },
    })
    expect(mocks.success).toHaveBeenCalledWith("saveSuccess")
  })

  it("reports a rejected save", async () => {
    mocks.saveMetadata.mockResolvedValue({ error: "Unauthorized" })
    render(<PhonologyView languageId="project" symbolIpas={[]} metadata={{}} />, { wrapper: withAccess(owner) })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /savePhonology/ })) })
    expect(mocks.error).toHaveBeenCalledWith("Unauthorized")
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("auto-detects the inventory from the alphabet's IPA values", () => {
    render(<PhonologyView languageId="project" symbolIpas={["p", "/a/", "tʃ"]} metadata={{}} />, { wrapper: withAccess(owner) })
    expect(screen.getByText("totalPhonemes")).toBeInTheDocument()
    expect(screen.getAllByText("p").length).toBeGreaterThan(0)
    expect(screen.getAllByText("tʃ").length).toBeGreaterThan(0)
  })
})

describe("phonology access", () => {
  const metadata = { syllableStructure: "CV", allophonyRules: "/t/ → [tʰ] / #_V" }

  it("shows a read-only visitor the inventory and rules without edit, reset or save", () => {
    render(<PhonologyView languageId="project" symbolIpas={["p", "a"]} metadata={metadata} />, {
      wrapper: withAccess({ isOwner: false, fullAccess: false, permissions: ["write:dictionary"] }),
    })
    expect(screen.getAllByText("p").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /editInventory/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /savePhonology/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText("syllableTemplate")).toHaveAttribute("readonly")
    expect(screen.getByLabelText("allophony")).toHaveAttribute("readonly")
  })

  it("offers editing and saving to a collaborator with the phonology scope", () => {
    render(<PhonologyView languageId="project" symbolIpas={["p", "a"]} metadata={metadata} />, {
      wrapper: withAccess({ isOwner: false, fullAccess: false, permissions: ["write:phonology"] }),
    })
    expect(screen.getByRole("button", { name: /editInventory/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /savePhonology/ })).toBeInTheDocument()
    expect(screen.getByLabelText("syllableTemplate")).not.toHaveAttribute("readonly")
  })
})
