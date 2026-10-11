import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn(), push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/app/actions/language", () => ({ updateLanguage: mocks.update }))
vi.mock("@/components/ui/select", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>
  // Like Radix: `disabled` on the root disables the trigger, which carries the id labels point at.
  const Select = ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) => <fieldset disabled={disabled}>{children}</fieldset>
  const SelectTrigger = ({ id }: { id?: string }) => <button type="button" id={id} />
  return { Select, SelectContent: () => null, SelectItem: Pass, SelectTrigger, SelectValue: () => null }
})
vi.mock("@/components/ui/slider", () => ({ Slider: () => null }))
vi.mock("@/components/ui/file-upload", () => ({ FileUpload: () => <span>upload field</span> }))
vi.mock("@/components/flag-generator", () => ({ FlagGenerator: () => null }))
vi.mock("@/components/ipa-speaker", () => ({ IPASpeaker: () => null }))
vi.mock("@/components/ipa-keyboard", () => ({ IPAKeyboard: () => null }))
vi.mock("../export-data-card", () => ({ ExportDataCard: () => null }))
vi.mock("../delete-language-card", () => ({ DeleteLanguageCard: () => null }))
import { LanguageSettings } from "../language-settings"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const owner: Access = { isOwner: true, fullAccess: true, permissions: [] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }

// Radix Switch measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
afterEach(() => { cleanup(); vi.clearAllMocks() })

const language = {
  id: "project", name: "Test", slug: "test", description: null, visibility: "PRIVATE", category: "CONLANG",
  flagUrl: null, fontScale: 1,
  // Keys owned by other editors, as they were when this tab loaded.
  metadata: { soundChangeRules: "a > e", wordOrder: "SOV", syllableStructure: "CV", tts: { voiceId: "Hans", speed: "110%" } },
}

describe("language settings save", () => {
  it("sends only the metadata keys the settings form owns", async () => {
    mocks.update.mockResolvedValue({ success: true, data: {}, slugChanged: false })
    render(<LanguageSettings language={language} languageSlug="test" isOwner />, { wrapper: withAccess(owner) })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "save" })) })
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.update.mock.calls[0][0].metadata).toEqual({ tts: { voiceId: "Hans", speed: "110%" } })
  })

  it("renders (and saves tts) when an unrelated legacy metadata field is invalid", async () => {
    mocks.update.mockResolvedValue({ success: true, data: {}, slugChanged: false })
    render(
      <LanguageSettings language={{ ...language, metadata: { vowels: null, tts: { voiceId: "Amy", speed: "slow" } } }} languageSlug="test" isOwner />,
      { wrapper: withAccess(owner) }
    )
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "save" })) })
    expect(mocks.update.mock.calls[0][0].metadata).toEqual({ tts: { voiceId: "Amy", speed: "slow" } })
  })
})

describe("language settings access", () => {
  const visitor = (permissions: string[]): Access => ({ isOwner: false, fullAccess: false, permissions })

  it("shows a visitor without the settings scope a read-only form with no save or uploads", async () => {
    render(<LanguageSettings language={language} languageSlug="test" />, { wrapper: withAccess(visitor(["write:grammar"])) })
    expect(screen.queryByRole("button", { name: "save" })).not.toBeInTheDocument()
    expect(screen.queryByText("upload field")).not.toBeInTheDocument()
    expect(screen.getByLabelText("nameLabel")).toBeDisabled()
    expect(screen.getByLabelText("descriptionLabel")).toBeDisabled()
    expect(screen.getByLabelText("diacriticalTitle")).toBeDisabled()
    expect(screen.getByLabelText("discordLabel")).toBeDisabled()
    // Submitting anyway (e.g. Enter in a field) writes nothing.
    await act(async () => { fireEvent.submit(screen.getByLabelText("nameLabel").closest("form")!) })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("lets a collaborator with the settings scope save, but keeps the owner-only slug locked", () => {
    render(<LanguageSettings language={language} languageSlug="test" isOwner={false} />, { wrapper: withAccess(visitor(["write:settings"])) })
    expect(screen.getByRole("button", { name: "save" })).toBeInTheDocument()
    expect(screen.getAllByText("upload field").length).toBeGreaterThan(0)
    expect(screen.getByLabelText("nameLabel")).toBeEnabled()
    expect(screen.getByLabelText("slugLabel")).toBeDisabled()
    // Visibility is the owner's call too, and the form says so.
    expect(screen.getByLabelText("visibilityLabel")).toBeDisabled()
    expect(screen.getByText("visibilityOwnerOnly")).toBeInTheDocument()
  })

  it("lets the owner change visibility", () => {
    render(<LanguageSettings language={language} languageSlug="test" isOwner />, { wrapper: withAccess(owner) })
    expect(screen.getByLabelText("visibilityLabel")).toBeEnabled()
    expect(screen.getByText("visibilityHint")).toBeInTheDocument()
  })
})
