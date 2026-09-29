import { describe, it, expect } from "vitest"
import { httpUrlOrPathSchema, httpUrlSchema, isSafeHttpUrl } from "../url"
import { isSafeHttpUrlOrPath } from "@/lib/utils/safe-url"

describe("safe link validation", () => {
  it("accepts http(s) URLs", () => {
    expect(isSafeHttpUrl("https://discord.gg/abc")).toBe(true)
    expect(httpUrlSchema.safeParse("http://example.com/x").success).toBe(true)
  })

  it("rejects script and data URLs", () => {
    for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<b>", "vbscript:x"]) {
      expect(httpUrlSchema.safeParse(bad).success).toBe(false)
      expect(httpUrlOrPathSchema.safeParse(bad).success).toBe(false)
    }
  })

  it("allows in-app paths but not protocol-relative URLs", () => {
    expect(httpUrlOrPathSchema.safeParse("/learn").success).toBe(true)
    expect(httpUrlOrPathSchema.safeParse("//evil.example").success).toBe(false)
  })

  it("the zod-free helper used by client components agrees with the schema", () => {
    for (const value of ["/learn", "https://x.test/a", "//evil.example", "javascript:alert(1)", "learn"]) {
      expect(isSafeHttpUrlOrPath(value)).toBe(httpUrlOrPathSchema.safeParse(value).success)
    }
  })
})

import { assetUrlSchema, optionalExternalLinkSchema } from "../url"

describe("optionalExternalLinkSchema", () => {
  it("clears on empty and upgrades bare domains", () => {
    expect(optionalExternalLinkSchema.parse("")).toBeNull()
    expect(optionalExternalLinkSchema.parse("example.com/lang")).toBe("https://example.com/lang")
    expect(optionalExternalLinkSchema.parse("https://t.me/x")).toBe("https://t.me/x")
  })

  it("rejects script URLs", () => {
    expect(optionalExternalLinkSchema.safeParse("javascript:alert(1)").success).toBe(false)
  })
})

describe("assetUrlSchema", () => {
  it("accepts our uploads and https assets", () => {
    expect(assetUrlSchema.safeParse("/uploads/font/1700000000-abc.ttf").success).toBe(true)
    expect(assetUrlSchema.safeParse("https://flagcdn.com/w80/fr.png").success).toBe(true)
  })

  it("rejects values that could break out of CSS url() or a style tag", () => {
    for (const bad of [
      "/uploads/font/x.ttf'); } body { background: red",
      "</style><script>alert(1)</script>",
      "javascript:alert(1)",
      "http://insecure.example/font.ttf",
      "/uploads/../../etc/passwd x",
    ]) {
      expect(assetUrlSchema.safeParse(bad).success).toBe(false)
    }
  })
})
