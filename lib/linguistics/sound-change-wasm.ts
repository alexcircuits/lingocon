/**
 * Browser loader for the Go→WASM sound-change core (linguistics-core/).
 *
 * The WASM module registers a synchronous `__linguisticsCore` API on the global
 * once instantiated; only *loading* is async. If anything fails (asset missing,
 * unsupported runtime), `loadSoundChangeCore` resolves to `null` and callers
 * fall back to the pure-TS engine in `lib/utils/sound-change.ts`.
 */

/** Synchronous API exposed by the WASM module once loaded. */
export interface SoundChangeCore {
  version: string
  /** apply(word, rulesText, vowels?, consonants?) -> changed string */
  apply(word: string, rulesText: string, vowels?: string[], consonants?: string[]): string
  /** applyPipeline(...) -> JSON string of { original, changed, rulesApplied } */
  applyPipeline(word: string, rulesText: string, vowels?: string[], consonants?: string[]): string
  /** batchApply(words, rulesText, vowels?, consonants?) -> JSON string of Result[] */
  batchApply(words: string[], rulesText: string, vowels?: string[], consonants?: string[]): string
}

interface GoRuntime {
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): Promise<void>
}

declare global {
  interface Window {
    Go?: new () => GoRuntime
    __linguisticsCore?: SoundChangeCore
    __linguisticsCoreReady?: () => void
  }
}

const WASM_URL = "/wasm/sound-change.wasm"
const EXEC_URL = "/wasm/wasm_exec.js"

let loadPromise: Promise<SoundChangeCore | null> | null = null

/** Lazily load (and memoize) the WASM core. Resolves to null on any failure. */
export function loadSoundChangeCore(): Promise<SoundChangeCore | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  if (window.__linguisticsCore) return Promise.resolve(window.__linguisticsCore)
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      await loadScript(EXEC_URL)
      if (!window.Go) return null

      const go = new window.Go()
      const ready = new Promise<void>((resolve) => {
        window.__linguisticsCoreReady = resolve
      })

      // Fetch + instantiate from bytes (avoids relying on a `application/wasm`
      // MIME type from the static host, which `instantiateStreaming` requires).
      const bytes = await (await fetch(WASM_URL)).arrayBuffer()
      const { instance } = await WebAssembly.instantiate(bytes, go.importObject)

      // go.run executes Go `main`, which registers the core then blocks on
      // `select{}` — so it never resolves. We intentionally do not await it;
      // the `ready` callback fires once registration is done.
      void go.run(instance)
      await ready

      return window.__linguisticsCore ?? null
    } catch {
      return null
    }
  })()

  return loadPromise
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}
