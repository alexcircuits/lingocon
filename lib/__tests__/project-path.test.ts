import { describe, expect, it } from "vitest"
import { parseProjectPath, withRenamedSlug } from "@/lib/project-path"

describe("parseProjectPath", () => {
  it.each([
    ["/studio/lang/old", { prefix: "/studio/lang", slug: "old", rest: "" }],
    ["/studio/lang/old/", { prefix: "/studio/lang", slug: "old", rest: "" }],
    ["/studio/lang/old/grammar/nouns", { prefix: "/studio/lang", slug: "old", rest: "/grammar/nouns" }],
    ["/lang/old/dictionary", { prefix: "/lang", slug: "old", rest: "/dictionary" }],
  ])("splits %s", (pathname, expected) => {
    expect(parseProjectPath(pathname)).toEqual(expected)
  })

  it.each([[null], [""], ["/dashboard"], ["/studio/old"], ["/language/old"]])("rejects %j", (pathname) => {
    expect(parseProjectPath(pathname)).toBeNull()
  })
})

describe("withRenamedSlug", () => {
  it("keeps the section of the renamed project", () => {
    expect(withRenamedSlug("/studio/lang/old/grammar/nouns", "/studio/lang", "old", "new")).toBe("/studio/lang/new/grammar/nouns")
    expect(withRenamedSlug("/lang/old/dictionary", "/lang", "old", "new")).toBe("/lang/new/dictionary")
    expect(withRenamedSlug("/studio/lang/old", "/studio/lang", "old", "new")).toBe("/studio/lang/new")
  })

  it("falls back to the project home when the path is unknown or belongs to another project", () => {
    expect(withRenamedSlug(null, "/studio/lang", "old", "new")).toBe("/studio/lang/new")
    expect(withRenamedSlug("/studio/lang/other/grammar", "/studio/lang", "old", "new")).toBe("/studio/lang/new")
    expect(withRenamedSlug("/lang/old/grammar", "/studio/lang", "old", "new")).toBe("/studio/lang/new")
  })
})
