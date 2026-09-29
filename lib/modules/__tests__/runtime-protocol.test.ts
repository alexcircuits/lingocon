import { describe, it, expect } from "vitest"
import {
  RUNTIME_METHODS,
  isRuntimeMethod,
  isWidgetMessage,
  permissionForMethod,
  type RuntimeMethod,
} from "../runtime-protocol"
import { MODULE_PERMISSIONS } from "../types"

// The full method -> permission contract. Adding a method to RUNTIME_METHODS
// without deciding its permission here fails the "exactly these methods" test.
const EXPECTED_PERMISSIONS: Record<RuntimeMethod, string | null> = {
  getLanguage: null,
  getDictionary: "read:dictionary",
  getPhonology: "read:phonology",
  getParadigms: "read:paradigms",
  getGrammar: "read:grammar",
  getTexts: "read:texts",
}

const METHODS = Object.keys(EXPECTED_PERMISSIONS) as RuntimeMethod[]

describe("isRuntimeMethod", () => {
  it("accepts exactly the methods in the contract", () => {
    expect(Object.keys(RUNTIME_METHODS).sort()).toEqual([...METHODS].sort())
  })

  it.each(METHODS)("accepts %s", (method) => {
    expect(isRuntimeMethod(method)).toBe(true)
  })

  it.each([
    ["an unknown method", "getSecrets"],
    ["an empty string", ""],
    ["a different casing", "getdictionary"],
    ["an upper-cased name", "GETDICTIONARY"],
    ["a leading space", " getDictionary"],
    ["a trailing space", "getDictionary "],
    ["a write method", "writeDictionary"],
  ])("rejects %s", (_label, value) => {
    expect(isRuntimeMethod(value)).toBe(false)
  })

  it.each([
    "__proto__",
    "constructor",
    "prototype",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "isPrototypeOf",
    "__defineGetter__",
  ])("rejects the inherited Object property name %j", (name) => {
    expect(isRuntimeMethod(name)).toBe(false)
  })

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["zero", 0],
    ["a number", 1],
    ["a boolean", true],
    ["an object", {}],
    ["an array holding a valid method", ["getDictionary"]],
    ["a symbol", Symbol("getDictionary")],
    ["a function", () => "getDictionary"],
  ])("rejects a non-string (%s)", (_label, value) => {
    expect(isRuntimeMethod(value)).toBe(false)
  })

  it("rejects an object that coerces to a valid method name", () => {
    expect(isRuntimeMethod({ toString: () => "getDictionary" })).toBe(false)
    expect(isRuntimeMethod(new String("getDictionary"))).toBe(false)
  })

  it("narrows a request's method so it can be used to look up a permission", () => {
    const method: unknown = "getPhonology"
    if (!isRuntimeMethod(method)) throw new Error("expected a runtime method")
    expect(permissionForMethod(method)).toBe("read:phonology")
  })
})

describe("permissionForMethod", () => {
  it("requires no permission for getLanguage (public metadata)", () => {
    expect(permissionForMethod("getLanguage")).toBeNull()
  })

  it.each(METHODS.filter((m) => EXPECTED_PERMISSIONS[m] !== null))(
    "maps %s to its read permission",
    (method) => {
      expect(permissionForMethod(method)).toBe(EXPECTED_PERMISSIONS[method])
    }
  )

  it("leaves getLanguage as the only permission-free method", () => {
    const free = METHODS.filter((m) => permissionForMethod(m) === null)
    expect(free).toEqual(["getLanguage"])
  })

  it("only ever asks for permissions a user can actually grant", () => {
    const grantable: readonly string[] = MODULE_PERMISSIONS
    for (const method of METHODS) {
      const required = permissionForMethod(method)
      if (required !== null) expect(grantable).toContain(required)
    }
  })

  it("never requires a write or ambient permission for a data read", () => {
    for (const method of METHODS) {
      const required = permissionForMethod(method)
      if (required !== null) expect(required).toMatch(/^read:/)
    }
  })
})

describe("isWidgetMessage", () => {
  it.each([
    ["ready", { source: "lingocon-module", type: "ready" }],
    ["request", { source: "lingocon-module", type: "request", id: 1, method: "getDictionary" }],
    ["resize", { source: "lingocon-module", type: "resize", height: 120 }],
    ["an unrecognised type", { source: "lingocon-module", type: "something-new" }],
  ])("accepts a module %s message", (_label, message) => {
    expect(isWidgetMessage(message)).toBe(true)
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "lingocon-module"],
    ["a number", 7],
    ["an empty object", {}],
    ["an array", [{ source: "lingocon-module", type: "ready" }]],
    ["a message from another source", { source: "other-frame", type: "ready" }],
    ["a host message (wrong direction)", { source: "lingocon-host", type: "response" }],
    ["a message without a type", { source: "lingocon-module" }],
    ["a message with a non-string type", { source: "lingocon-module", type: 1 }],
    ["a message with a non-string source", { source: ["lingocon-module"], type: "ready" }],
  ])("rejects %s", (_label, message) => {
    expect(isWidgetMessage(message)).toBe(false)
  })
})
