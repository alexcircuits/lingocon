import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock("@/app/actions/language", () => ({ updateLanguage: mocks.update }))
import { InlineLanguageEdit } from "../inline-language-edit"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const owner: Access = { isOwner: true, fullAccess: true, permissions: [] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const unhandled = vi.fn()
beforeEach(() => { process.on("unhandledRejection", unhandled) })
afterEach(() => {
  process.off("unhandledRejection", unhandled)
  cleanup()
  vi.clearAllMocks()
})

function startEditing(value: string) {
  render(<InlineLanguageEdit languageId="project" field="name" value="Old name" />, { wrapper: withAccess(owner) })
  fireEvent.click(screen.getByText("Old name"))
  fireEvent.change(screen.getByRole("textbox"), { target: { value } })
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" })
}

describe("overview inline language edit", () => {
  it("keeps the editor open until the save finishes, then shows the new value", async () => {
    const save = deferred<{ success: true; data: unknown }>()
    mocks.update.mockReturnValue(save.promise)
    startEditing("New name")
    expect(mocks.update).toHaveBeenCalledWith({ id: "project", name: "New name" })
    expect(screen.getByRole("textbox")).toHaveValue("New name")
    await act(async () => { save.resolve({ success: true, data: {} }) })
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    // The saved value shows immediately, not the stale prop until a refresh lands.
    expect(screen.getByText("New name")).toBeInTheDocument()
    expect(screen.queryByText("Old name")).not.toBeInTheDocument()
    expect(mocks.success).toHaveBeenCalledWith("nameUpdated")
  })

  it("keeps the user's text and shows the error when the save is rejected", async () => {
    mocks.update.mockResolvedValue({ error: "A language with this slug already exists" })
    startEditing("Rejected name")
    await act(async () => { await new Promise((done) => setTimeout(done, 0)) })
    expect(screen.getByRole("textbox")).toHaveValue("Rejected name")
    expect(screen.getByText("A language with this slug already exists")).toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(unhandled).not.toHaveBeenCalled()
  })

  it("keeps the user's text and shows a readable error when the request itself fails", async () => {
    mocks.update.mockRejectedValue(new TypeError("Failed to fetch"))
    startEditing("Offline name")
    await act(async () => { await new Promise((done) => setTimeout(done, 0)) })
    expect(screen.getByRole("textbox")).toHaveValue("Offline name")
    expect(screen.getByRole("alert")).toHaveTextContent("saveFailed")
    expect(mocks.error).toHaveBeenCalledWith("saveFailed")
    expect(unhandled).not.toHaveBeenCalled()
  })

  it("follows a newer value from the server", () => {
    const view = render(<InlineLanguageEdit languageId="project" field="name" value="Old name" />, { wrapper: withAccess(owner) })
    view.rerender(<InlineLanguageEdit languageId="project" field="name" value="Server name" />)
    expect(screen.getByText("Server name")).toBeInTheDocument()
  })
})

describe("overview inline language edit access", () => {
  const visitor = (permissions: string[]): Access => ({ isOwner: false, fullAccess: false, permissions })

  it("shows a visitor without the settings scope the plain value, with no way to edit it", () => {
    render(<InlineLanguageEdit languageId="project" field="name" value="Old name" />, { wrapper: withAccess(visitor(["write:grammar"])) })
    expect(screen.getByText("Old name")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Old name"))
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("shows an empty description as a dash rather than an invitation to add one", () => {
    render(<InlineLanguageEdit languageId="project" field="description" value="" />, { wrapper: withAccess(visitor([])) })
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.queryByText("descriptionPlaceholder")).not.toBeInTheDocument()
  })

  it("lets a collaborator with the settings scope edit", () => {
    render(<InlineLanguageEdit languageId="project" field="name" value="Old name" />, { wrapper: withAccess(visitor(["write:settings"])) })
    fireEvent.click(screen.getByText("Old name"))
    expect(screen.getByRole("textbox")).toHaveValue("Old name")
  })
})
