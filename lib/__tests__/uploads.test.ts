import { describe, it, expect } from "vitest"
import { validateUpload, UPLOAD_RULES, type UploadType } from "@/lib/uploads"

const base = { name: "file.png", mimeType: "image/png", size: 1000 }

describe("validateUpload", () => {
  it("accepts a valid image for 'flag'", () => {
    const result = validateUpload({ ...base, type: "flag" })
    expect(result).toEqual({ ok: true, ext: "png", dir: "flag" })
  })

  it("maps 'image' type to the 'cover' directory", () => {
    const result = validateUpload({ ...base, type: "image" })
    expect(result).toEqual({ ok: true, ext: "png", dir: "cover" })
  })

  it("rejects unknown upload types", () => {
    const result = validateUpload({ ...base, type: "evil" as UploadType })
    expect(result.ok).toBe(false)
  })

  it("rejects oversized files per type", () => {
    const tooBig = UPLOAD_RULES["word-audio"].maxBytes + 1
    const result = validateUpload({ name: "w.webm", mimeType: "audio/webm", size: tooBig, type: "word-audio" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/too large/i)
  })

  it("accepts word-audio under the 1MB cap", () => {
    const result = validateUpload({ name: "w.webm", mimeType: "audio/webm", size: 500_000, type: "word-audio" })
    expect(result).toEqual({ ok: true, ext: "webm", dir: "word-audio" })
  })

  it("rejects wrong MIME for the type", () => {
    const result = validateUpload({ name: "x.png", mimeType: "image/png", size: 100, type: "audio" })
    expect(result.ok).toBe(false)
  })

  it("strips MIME parameters before matching", () => {
    const result = validateUpload({ name: "a.webm", mimeType: "audio/webm;codecs=opus", size: 100, type: "audio" })
    expect(result.ok).toBe(true)
  })

  it("falls back to extension for fonts with generic MIME", () => {
    const result = validateUpload({ name: "MyFont.woff2", mimeType: "application/octet-stream", size: 100, type: "font" })
    expect(result).toEqual({ ok: true, ext: "woff2", dir: "font" })
  })

  it("normalizes hostile extensions to the allow-list", () => {
    const result = validateUpload({ name: "../../etc/passwd%00.png", mimeType: "image/png", size: 100, type: "image" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.ext).toBe("png")
  })

  it("rejects extensions not allowed for the type even with valid MIME", () => {
    const result = validateUpload({ name: "sneaky.html", mimeType: "image/png", size: 100, type: "image" })
    expect(result.ok).toBe(false)
  })
})
