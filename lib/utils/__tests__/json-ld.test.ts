import { describe, it, expect } from "vitest"
import { serializeJsonLd } from "../json-ld"

describe("serializeJsonLd", () => {
  it("cannot be broken out of with a closing script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" })
    expect(out).not.toContain("</script")
    expect(out).not.toContain("<")
  })

  it("stays equivalent JSON", () => {
    const data = { name: "A & B <x>", nested: { list: ["\u2028", "ä"] } }
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data)
  })
})
