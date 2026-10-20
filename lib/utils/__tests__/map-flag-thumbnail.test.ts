import { describe, expect, it } from "vitest"
import { mapFlagThumbnail } from "../map-flag-thumbnail"

describe("mapFlagThumbnail", () => {
  it("requests an optimizer thumbnail instead of the multi-megapixel original", () => {
    const src = "/uploads/flag/large.webp"
    const url = new URL(mapFlagThumbnail(src)!, "https://lingocon.com")
    expect(url.pathname).toBe("/_next/image")
    expect(url.searchParams.get("url")).toBe(src)
    expect(Number(url.searchParams.get("w"))).toBeLessThanOrEqual(128)
  })
  it("does not silently load originals that Next leaves unoptimized", () => {
    expect(mapFlagThumbnail("/uploads/flag/example.svg")).toBeNull()
    expect(mapFlagThumbnail("data:image/png;base64,AA")).toBeNull()
  })
})
