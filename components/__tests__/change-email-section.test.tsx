import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const actions = vi.hoisted(() => ({
  getEmailSettings: vi.fn(),
  requestEmailChange: vi.fn(),
  cancelPendingEmailChange: vi.fn(),
}))

vi.mock("@/app/actions/email-change", () => actions)

import { ChangeEmailSection } from "../settings/change-email-section"

function settings(overrides: Record<string, unknown> = {}) {
  return { email: "old@example.test", hasPassword: true, providers: [], pendingEmail: null, ...overrides }
}

/** Renders the section and waits until it has loaded the account's email settings. */
async function renderLoaded(overrides: Record<string, unknown> = {}, props: Partial<Parameters<typeof ChangeEmailSection>[0]> = {}) {
  actions.getEmailSettings.mockResolvedValue(settings(overrides))
  render(<ChangeEmailSection sessionEmail="old@example.test" {...props} />)
  await waitFor(() => expect(screen.getByRole("button", { name: "Change email" })).toBeEnabled())
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.requestEmailChange.mockResolvedValue({ success: true, pendingEmail: "new@example.test" })
  actions.cancelPendingEmailChange.mockResolvedValue({ success: true })
})

describe("ChangeEmailSection", () => {
  it("shows the current address and keeps the form closed until asked", async () => {
    await renderLoaded()

    expect(screen.getByText("old@example.test")).toBeInTheDocument()
    expect(screen.queryByLabelText("New email address")).not.toBeInTheDocument()
  })

  it("asks a password account for its current password and sends both to the server", async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole("button", { name: "Change email" }))

    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.test" } })
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "hunter2hunter2" } })
    fireEvent.click(screen.getByRole("button", { name: "Send confirmation link" }))

    await waitFor(() =>
      expect(actions.requestEmailChange).toHaveBeenCalledWith({ newEmail: "new@example.test", currentPassword: "hunter2hunter2" }),
    )
    // The address has not changed yet: say where the link went and what is still true.
    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent("new@example.test")
    expect(status).toHaveTextContent("1 hour")
    expect(screen.getByText("old@example.test")).toBeInTheDocument()
    expect(screen.queryByLabelText("New email address")).not.toBeInTheDocument()
  })

  it("asks an account that only signs in with Google for no password, and says what the change does not do", async () => {
    await renderLoaded({ hasPassword: false, providers: ["google"] })

    expect(screen.getByText(/does not change which Google account you sign in with/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Change email" }))
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.test" } })
    fireEvent.click(screen.getByRole("button", { name: "Send confirmation link" }))

    await waitFor(() => expect(actions.requestEmailChange).toHaveBeenCalledWith({ newEmail: "new@example.test" }))
  })

  it("shows the server's reason next to the form and keeps what was typed", async () => {
    actions.requestEmailChange.mockResolvedValue({ error: "Current password is incorrect." })
    await renderLoaded()
    fireEvent.click(screen.getByRole("button", { name: "Change email" }))
    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.test" } })
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "wrong" } })
    fireEvent.click(screen.getByRole("button", { name: "Send confirmation link" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect.")
    expect(screen.getByLabelText("New email address")).toHaveValue("new@example.test")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("shows a change that is waiting for confirmation and lets the user cancel it", async () => {
    await renderLoaded({ pendingEmail: "new@example.test" })

    expect(screen.getByRole("status")).toHaveTextContent("new@example.test")
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }))

    await waitFor(() => expect(actions.cancelPendingEmailChange).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
  })

  it("asks for a session refresh when the session still shows an address the account no longer has", async () => {
    const onSessionOutOfDate = vi.fn()
    await renderLoaded({ email: "new@example.test" }, { onSessionOutOfDate })

    expect(screen.getByText("new@example.test")).toBeInTheDocument()
    expect(onSessionOutOfDate).toHaveBeenCalledTimes(1)
  })

  it("asks again while the session still shows the old address, and stops once it catches up", async () => {
    // A refresh can be dropped (the session client ignores one while busy, or the request fails).
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const onSessionOutOfDate = vi.fn()
      actions.getEmailSettings.mockResolvedValue(settings({ email: "new@example.test" }))
      const { rerender } = render(<ChangeEmailSection sessionEmail="old@example.test" onSessionOutOfDate={onSessionOutOfDate} />)
      await waitFor(() => expect(onSessionOutOfDate).toHaveBeenCalledTimes(1))

      await vi.advanceTimersByTimeAsync(4_000)
      expect(onSessionOutOfDate).toHaveBeenCalledTimes(2)

      rerender(<ChangeEmailSection sessionEmail="new@example.test" onSessionOutOfDate={onSessionOutOfDate} />)
      await vi.advanceTimersByTimeAsync(20_000)
      expect(onSessionOutOfDate).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("gives up after three attempts instead of asking forever", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const onSessionOutOfDate = vi.fn()
      actions.getEmailSettings.mockResolvedValue(settings({ email: "new@example.test" }))
      render(<ChangeEmailSection sessionEmail="old@example.test" onSessionOutOfDate={onSessionOutOfDate} />)
      await waitFor(() => expect(onSessionOutOfDate).toHaveBeenCalledTimes(1))

      await vi.advanceTimersByTimeAsync(60_000)
      expect(onSessionOutOfDate).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it("leaves the session alone when it already matches", async () => {
    const onSessionOutOfDate = vi.fn()
    await renderLoaded({}, { onSessionOutOfDate })

    expect(onSessionOutOfDate).not.toHaveBeenCalled()
  })
})
