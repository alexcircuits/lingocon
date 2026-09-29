import { describe, it, expect } from "vitest"
import { resolveGrantedPermissions } from "../utils"

describe("resolveGrantedPermissions", () => {
  it("uses exactly what the user consented to", () => {
    expect(resolveGrantedPermissions(["read:dictionary"], ["read:dictionary", "export"])).toEqual([
      "read:dictionary",
    ])
  })

  it("treats explicit empty consent as no permissions", () => {
    expect(resolveGrantedPermissions([], ["read:dictionary", "export"])).toEqual([])
  })

  it("falls back to declared permissions only for legacy installs without a consent record", () => {
    expect(resolveGrantedPermissions(null, ["read:dictionary"])).toEqual(["read:dictionary"])
    expect(resolveGrantedPermissions(undefined, null)).toEqual([])
  })
})
