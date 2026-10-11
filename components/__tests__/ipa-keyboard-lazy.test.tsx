import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import { IPAKeyboard } from "@/components/ipa-keyboard"

// Warm the keyboard module so the boundary resolves well within waitFor's timeout.
beforeAll(async () => { await import("@/components/ipa-keyboard-panel") }, 30_000)

describe("code-split IPA keyboard", () => {
  it("holds its width while the symbol tables load, then types symbols", async () => {
    const onSelect = vi.fn()
    const { container } = render(<IPAKeyboard onSelect={onSelect} />)
    expect(container.querySelector("[aria-busy='true']")).toHaveClass("w-[400px]")

    await waitFor(() => expect(container.querySelector("[aria-busy='true']")).toBeNull(), { timeout: 5_000 })
    const symbol = screen.getAllByRole("button").find((button) => button.textContent === "p")
    expect(symbol).toBeDefined()
    await act(async () => { fireEvent.click(symbol!) })
    expect(onSelect).toHaveBeenCalledWith("p")
  })
})
