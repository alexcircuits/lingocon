import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FileUpload } from "@/components/ui/file-upload"

// Warm the dropzone module so the boundary below resolves well within waitFor's timeout.
beforeAll(async () => { await import("@/components/ui/file-upload-dropzone") }, 30_000)
afterEach(() => { vi.unstubAllGlobals() })

describe("code-split file upload", () => {
  it("shows the same drop area while the dropzone code loads, then uploads a chosen file", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "/uploads/cover.png", filename: "cover.png", size: 3 })))
    vi.stubGlobal("fetch", fetchMock)
    const onChange = vi.fn()
    const { container } = render(<FileUpload type="image" onChange={onChange} placeholder="Drop a cover" />)

    // Visible before the dropzone code arrives: same text and size hint, nothing to click yet.
    expect(screen.getByText("Drop a cover")).toBeInTheDocument()
    expect(screen.getByText("Max size: 10MB")).toBeInTheDocument()
    expect(container.querySelector("input[type='file']")).toBeNull()

    await waitFor(() => expect(container.querySelector("input[type='file']")).not.toBeNull())
    expect(screen.getByText("Drop a cover")).toBeInTheDocument()

    const input = container.querySelector("input[type='file']") as HTMLInputElement
    const file = new File(["png"], "cover.png", { type: "image/png" })
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }) })

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("/uploads/cover.png", { filename: "cover.png", size: 3 }))
    expect(fetchMock).toHaveBeenCalledWith("/api/upload", expect.objectContaining({ method: "POST" }))
  })

  it("shows an existing file's preview with a working remove button", async () => {
    const onChange = vi.fn()
    render(<FileUpload type="image" value="/uploads/flag.png" onChange={onChange} />)
    expect(screen.getByRole("img", { name: "Uploaded" })).toHaveAttribute("src", "/uploads/flag.png")

    fireEvent.click(await screen.findByRole("button", { name: "Remove file" }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
