import { describe, it, expect } from "vitest"
import {
  validateUpload,
  UPLOAD_RULES,
  isSafeSvg,
  signatureMatches,
  type UploadType,
} from "@/lib/uploads"

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

describe("isSafeSvg", () => {
  it("accepts an ordinary icon SVG", () => {
    expect(isSafeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z"/></svg>')).toBe(true)
  })

  it("rejects an SVG carrying a <script> element", () => {
    expect(isSafeSvg('<svg><script>alert(1)</script></svg>')).toBe(false)
  })

  it("rejects an inline event handler", () => {
    expect(isSafeSvg('<svg><rect onload="alert(1)"/></svg>')).toBe(false)
  })

  it("rejects a javascript: URL and external entity", () => {
    expect(isSafeSvg('<svg><a href="javascript:alert(1)">x</a></svg>')).toBe(false)
    expect(isSafeSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>')).toBe(false)
  })

  it("rejects entity-encoded javascript: schemes (bypass regression)", () => {
    expect(isSafeSvg('<svg><a href="&#106;avascript:fetch(1)">x</a></svg>')).toBe(false)
    expect(isSafeSvg('<svg><a href="&#x6a;avascript:alert(1)">x</a></svg>')).toBe(false)
  })

  it("rejects control-char-obfuscated javascript: (browsers ignore Tab/CR in URLs)", () => {
    expect(isSafeSvg('<svg><a href="jav&#9;ascript:alert(1)">x</a></svg>')).toBe(false)
  })

  it("rejects an external DOCTYPE", () => {
    expect(isSafeSvg('<!DOCTYPE svg SYSTEM "http://attacker.example/evil.dtd"><svg/>')).toBe(false)
  })
})

describe("signatureMatches", () => {
  const bytes = (...b: number[]) => Uint8Array.from(b)

  it("accepts a real PNG signature", () => {
    expect(signatureMatches(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d), "png")).toBe(true)
  })

  it("rejects HTML masquerading as a PNG", () => {
    // "<htm" leading bytes for a .png upload.
    expect(signatureMatches(bytes(0x3c, 0x68, 0x74, 0x6d), "png")).toBe(false)
  })

  it("accepts a real PDF and rejects a fake one", () => {
    expect(signatureMatches(bytes(0x25, 0x50, 0x44, 0x46), "pdf")).toBe(true)
    expect(signatureMatches(bytes(0x00, 0x00, 0x00, 0x00), "pdf")).toBe(false)
  })

  it("accepts a woff2 font and an OggS audio header", () => {
    expect(signatureMatches(bytes(0x77, 0x4f, 0x46, 0x32), "woff2")).toBe(true)
    expect(signatureMatches(bytes(0x4f, 0x67, 0x67, 0x53), "ogg")).toBe(true)
  })

  it("passes types without a known signature (txt)", () => {
    expect(signatureMatches(bytes(0x68, 0x69), "txt")).toBe(true)
  })
})
