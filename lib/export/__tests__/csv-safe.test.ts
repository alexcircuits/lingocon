import { describe, it, expect } from "vitest"
import { sanitizeCsvCell } from "@/lib/export/csv-safe"

describe("sanitizeCsvCell", () => {
  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "prefixes a leading %j trigger with a single quote",
    (trigger) => {
      const out = sanitizeCsvCell(`${trigger}cmd|'/c calc'!A1`)
      expect(out.startsWith("'")).toBe(true)
      expect(out).toBe(`'${trigger}cmd|'/c calc'!A1`)
    },
  )

  it("neutralizes a HYPERLINK exfiltration payload", () => {
    expect(sanitizeCsvCell('=HYPERLINK("http://evil.tld","x")')).toBe(
      `'=HYPERLINK("http://evil.tld","x")`,
    )
  })

  it("leaves ordinary lemmas/glosses untouched", () => {
    expect(sanitizeCsvCell("water")).toBe("water")
    expect(sanitizeCsvCell("kʷénts")).toBe("kʷénts")
    expect(sanitizeCsvCell("to run (verb)")).toBe("to run (verb)")
  })

  it("only reacts to the FIRST character, not internal triggers", () => {
    expect(sanitizeCsvCell("a=b")).toBe("a=b")
    expect(sanitizeCsvCell("1+1")).toBe("1+1")
  })

  it("passes through empty strings unchanged", () => {
    expect(sanitizeCsvCell("")).toBe("")
  })
})
