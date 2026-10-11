/**
 * Parity: the browser's sound-change preview (Go → WASM, linguistics-core/)
 * must show exactly what the server writes when the rules are applied
 * (lib/utils/sound-change.ts: parseProgram + applyPipeline, i.e. batchApply).
 *
 * This runs the BUILT public/wasm/sound-change.wasm with the shipped
 * wasm_exec.js through the real loader (loadSoundChangeCore) and the real
 * `useSoundChangeEngine` hook the sound-change editor uses — only the two
 * things jsdom cannot do are stood in for: executing the <script> tag and
 * serving the .wasm file. A stale binary therefore fails this test; rebuild
 * it with `npm run build:wasm`.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { renderHook, waitFor } from "@testing-library/react"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { batchApply, parseProgram, parseRule, type SoundChangeResult } from "@/lib/utils/sound-change"
import { useSoundChangeEngine, type SoundChangeEngine } from "../use-sound-change-engine"
import { randomCase, rng, type ParityCase } from "./sound-change-parity-generator"

// (A path, not `new URL(…)`: jsdom replaces the global URL class.)
const WASM_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../public/wasm")
const EXEC_URL = "/wasm/wasm_exec.js"
const WASM_URL = "/wasm/sound-change.wasm"

/** Serve the built assets the way the browser would load them. */
function installWasmAssets(): void {
  const execSource = readFileSync(path.join(WASM_DIR, "wasm_exec.js"), "utf8")
  const wasm = readFileSync(path.join(WASM_DIR, "sound-change.wasm"))
  const wasmBytes = wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)

  const appendChild = document.head.appendChild.bind(document.head)
  vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
    const appended = appendChild(node)
    if (node instanceof HTMLScriptElement && node.getAttribute("src") === EXEC_URL) {
      // jsdom does not run external scripts. Run it as a browser would: no
      // `require`, and a `module` that is not the main module.
      new Function("require", "module", execSource)(undefined, {})
      queueMicrotask(() => node.dispatchEvent(new Event("load")))
    }
    return appended
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url !== WASM_URL) throw new Error(`unexpected fetch: ${url}`)
      return { arrayBuffer: async () => wasmBytes } as Response
    })
  )
}

let engine: SoundChangeEngine
let unmount: () => void

beforeAll(async () => {
  installWasmAssets()
  const hook = renderHook(() => useSoundChangeEngine())
  unmount = hook.unmount
  await waitFor(() => expect(hook.result.current.source).toBe("wasm"), { timeout: 15_000 })
  engine = hook.result.current
}, 20_000)

afterAll(() => {
  unmount?.()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** What the server writes: parseProgram + applyPipeline per word (app/actions/apply-sound-changes.ts). */
function serverResults({ rulesText, words, vowels, consonants }: ParityCase): SoundChangeResult[] {
  const { classes, rules } = parseProgram(rulesText)
  return batchApply(words, rules, vowels, consonants, classes)
}

/** What the preview shows once the WASM core is loaded. */
function previewResults({ rulesText, words, vowels, consonants }: ParityCase): SoundChangeResult[] {
  return engine.batchApply(words, rulesText, vowels, consonants)
}

function describeCase(c: ParityCase): string {
  return JSON.stringify({
    rulesText: c.rulesText,
    words: c.words,
    vowels: c.vowels && [...c.vowels],
    consonants: c.consonants && [...c.consonants],
  })
}

function expectParity(c: ParityCase): SoundChangeResult[] {
  const server = serverResults(c)
  expect(previewResults(c), describeCase(c)).toEqual(server)
  return server
}

const changedWords = (c: ParityCase) => serverResults(c).map(r => r.changed)

/** A line with an arrow character that the parser nevertheless rejects (e.g. `a->`, `a→`, a line terminator inside). */
function isRejectedRuleLine(line: string): boolean {
  const trimmed = line.trim()
  return /→|>/.test(line) && !trimmed.startsWith("class ") && !trimmed.startsWith("#") && !trimmed.startsWith("//") && parseRule(line, "x") === null
}

describe("sound-change preview (WASM) vs server (TypeScript)", () => {
  it("runs the rebuilt engine", () => {
    expect(window.__linguisticsCore?.version).toBe("soundchange-2")
  })

  it("matches on thousands of seeded random programs, inventories and words", () => {
    const next = rng(20261010)
    const mismatches: string[] = []
    let words = 0
    let changed = 0
    let firedRules = 0
    let dollarRewrites = 0
    let rejectedRuleLines = 0
    for (let n = 0; n < 15_000; n++) {
      const c = randomCase(next)
      const server = serverResults(c)
      const preview = previewResults(c)
      if (JSON.stringify(preview) !== JSON.stringify(server)) {
        mismatches.push(`${describeCase(c)}\n  preview: ${JSON.stringify(preview)}\n  server:  ${JSON.stringify(server)}`)
      }
      rejectedRuleLines += c.rulesText.split("\n").filter(isRejectedRuleLine).length
      for (const result of server) {
        words++
        if (result.changed !== result.original) changed++
        firedRules += result.rulesApplied.length
        dollarRewrites += result.rulesApplied.filter(raw => /\$[$&`']/.test(raw)).length
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([])
    expect(mismatches).toHaveLength(0)
    // The generator must exercise real rewrites, `$` expansion and the parser's reject paths.
    expect(words).toBeGreaterThan(50_000)
    expect(changed).toBeGreaterThan(5_000)
    expect(firedRules).toBeGreaterThan(5_000)
    expect(dollarRewrites).toBeGreaterThan(1_500)
    expect(rejectedRuleLines).toBeGreaterThan(1_000)
  }, 60_000)

  describe("fixed edge cases", () => {
    it("considers every split of an environment (the E2E repro)", () => {
      const vowels = new Set(["a", "aa"])
      const consonants = new Set(["b"])
      expect(changedWords({ rulesText: "a → e / _VVb", words: ["aaab"], vowels, consonants })).toEqual(["eaab"])
      for (const rulesText of ["a → e / _VVb", "a → e / bVV_", "a → e / _VV#", "a → e / #VV_"]) {
        expectParity({ rulesText, words: ["aaab", "baaa", "aaa", "ab", "aab"], vowels, consonants })
      }
      expectParity({ rulesText: "class Z = z zz\na → e / _ZZb\nZ → x / _zb", words: ["azzb", "zzb", "azzzb"] })
    })

    it("treats `.` as one UTF-16 unit (half an astral character) and never a line terminator", () => {
      const rulesText = "b → x / .._\na → y / _.b\nd → w / _."
      const words = ["😀b", "a😀b", "a😀😀b", "d\n", "d\r", "d\u2028", "d\u2029", "de", "d\u0301"]
      expect(changedWords({ rulesText: "b → x / .._", words: ["😀b"] })).toEqual(["😀x"])
      expectParity({ rulesText, words })
      expectParity({ rulesText: "😀 → 𝔞 / _#\n𝔞 → $&$& / #_", words: ["a😀", "𝔞😀", "😀😀"] })
    })

    it("expands `$` patterns in replacements like String#replace", () => {
      const rulesText = ["a → [$&]", "e → $$", "i → $`", "o → $'", "u → $1$<x>$0$", "y → $$&"].join("\n")
      const server = expectParity({ rulesText, words: ["xay", "aeiouy", "", "$a$"] })
      // a → [a], then y → "$&" (`$$` is a literal `$`).
      expect(server[0].changed).toBe("x[a]$&")
    })

    it("parses rules like the TypeScript regex and String#trim", () => {
      const lines = [
        "a->", "a→", "->b", "a-->b", "a=->c", "a - > d", "\uFEFFt → d\uFEFF", "\u0085s → z",
        "\u00A0k\u3000→\u2003g\u202F", "m → n\rx", "p → b / c _ d / e", "q → ∅ / _#", "  # comment → x",
      ]
      expectParity({ rulesText: lines.join("\n"), words: ["a-b", "-a", "tks\u0085s", "pcpd / e", "qq", "a>b"] })
      expectParity({ rulesText: "a → e\r\nb → p\r\n", words: ["abba"] })
    })

    it("reads class definitions like the TypeScript parser", () => {
      const rulesText = [
        "class K = p", "class K = t", "class KW = kw", "class S = a\u0085b c\uFEFFd",
        "class V = a", "class K1 = b", "K → x", "a → e / KW_", "S → s", "a\u0085b → y",
      ].join("\n")
      expectParity({ rulesText, words: ["tpkwa", "a\u0085b", "cd", "kwaKt"] })
    })

    it("follows the inventories the editor passes, including empty ones", () => {
      for (const vowels of [undefined, new Set<string>(), new Set([""]), new Set(["", "a"])]) {
        expectParity({ rulesText: "t → d / V_V\ns → z / _C", words: ["ata", "tt", "aːtaː", "e\u031Ete\u031E", "st"], vowels })
      }
      expect(changedWords({ rulesText: "t → d / V_V", words: ["tt"], vowels: new Set() })).toEqual(["dd"])
    })

    it("anchors at `#` anywhere in an environment and ignores an environment of exactly `_`", () => {
      expectParity({ rulesText: "a → e / _#b\na → i / b#_\no → u / x__", words: ["ab", "ba", "abb", "xob", "bab"] })
    })

    it("does not report a rewrite to identical text", () => {
      const [result] = expectParity({ rulesText: "a → $&\na → a\nb → p", words: ["bab"] })
      expect(result).toEqual({ original: "bab", changed: "pap", rulesApplied: ["b → p"] })
    })

    it("stays fast on environments whose classes share prefixes", () => {
      const vowels = new Set(["a", "aa"])
      const consonants = new Set(["b"])
      const word = "a".repeat(2_000)
      const rulesText = `a → e / _${"V".repeat(30)}b\na → e / b${"V".repeat(30)}_`
      const started = performance.now()
      const [result, left] = previewResults({ rulesText, words: [word, "b" + "a".repeat(60)], vowels, consonants })
      const elapsed = performance.now() - started
      expect(result.changed).toBe(word)
      expect(left.changed).toBe("b" + "a".repeat(30) + "e".repeat(30))
      expect(elapsed).toBeLessThan(1_000)
    })
  })

  it("differs only where a lone surrogate crosses the JS → Go boundary (it arrives as U+FFFD)", () => {
    const high = String.fromCharCode(0xd83d)
    const low = String.fromCharCode(0xde00)
    const words = [`a${high}`, `${low}a`, `${high}b${low}`]
    const rulesText = "a → e / _.\nb → x / ._.\na → o"
    // toWellFormed replaces each lone surrogate with U+FFFD, as TextEncoder does at the boundary.
    const preview = previewResults({ rulesText, words })
    expect(preview).toEqual(serverResults({ rulesText, words: words.map(w => w.toWellFormed()) }))
    expect(preview).not.toEqual(serverResults({ rulesText, words }))
  })
})
