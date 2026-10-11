import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/app/actions/collaborator", () => ({
  getCollaborators: mocks.load, inviteCollaborator: vi.fn(), updateCollaboratorPermissions: vi.fn(),
  removeCollaborator: vi.fn(), transferLanguageOwnership: vi.fn(),
}))
vi.mock("@/components/user-search", () => ({ UserSearch: () => null }))
// The card itself; "../collaborators" is its code-split entry point (settings-lazy-cards.test.tsx).
import { Collaborators } from "../collaborators-impl"

function collaborator(name: string) {
  return {
    id: `collab-${name}`, languageId: "project", userId: `user-${name}`, role: "EDITOR", permissions: ["write:dictionary"],
    createdAt: new Date(), updatedAt: new Date(), user: { id: `user-${name}`, name, image: null },
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
afterEach(() => { cleanup(); mocks.load.mockReset() })

describe.each([true, false])("collaborator list load failures (owner: %s)", (isOwner) => {
  it("shows an error with retry instead of an empty list when the load is refused", async () => {
    mocks.load
      .mockResolvedValueOnce({ error: "Unauthorized" })
      .mockResolvedValueOnce({ success: true, data: [collaborator("Ada Lovelace")] })
    render(<Collaborators languageId="project" languageSlug="project" isOwner={isOwner} />)
    await screen.findByText("collaboratorsLoadFailed")
    expect(screen.queryByText(/No collaborators/)).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "tryAgain" })) })
    expect((await screen.findAllByText("Ada Lovelace")).length).toBeGreaterThan(0)
    expect(screen.queryByText("collaboratorsLoadFailed")).not.toBeInTheDocument()
  })

  it("shows an error with retry when the request itself fails", async () => {
    mocks.load.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    render(<Collaborators languageId="project" languageSlug="project" isOwner={isOwner} />)
    await screen.findByText("collaboratorsLoadFailed")
    expect(screen.queryByText(/No collaborators/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "tryAgain" })).toBeEnabled()
  })

  it("still shows the empty state for a project that really has no collaborators", async () => {
    mocks.load.mockResolvedValueOnce({ success: true, data: [] })
    render(<Collaborators languageId="project" languageSlug="project" isOwner={isOwner} />)
    expect(await screen.findByText(/No collaborators/)).toBeInTheDocument()
  })

  it("ignores a response that arrives after a newer request", async () => {
    const first = deferred<unknown>()
    const second = deferred<unknown>()
    mocks.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = render(<Collaborators languageId="first" languageSlug="first" isOwner={isOwner} />)
    view.rerender(<Collaborators languageId="second" languageSlug="second" isOwner={isOwner} />)
    await act(async () => { second.resolve({ success: true, data: [collaborator("Second Project")] }) })
    await act(async () => { first.resolve({ success: true, data: [collaborator("First Project")] }) })
    expect((await screen.findAllByText("Second Project")).length).toBeGreaterThan(0)
    expect(screen.queryByText("First Project")).not.toBeInTheDocument()
  })
})
