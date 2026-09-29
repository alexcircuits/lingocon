/**
 * Runs user-supplied regular expressions off the main thread with a hard deadline.
 *
 * JavaScript regexes backtrack, and no syntactic heuristic can bound that: `\w*` repeated eleven
 * times followed by `!` has no nested quantifier yet takes ~18 s on a 28-character lemma. Running it
 * in the shared Next.js server process would stall every request, so the replace loop executes in a
 * short-lived worker thread that is terminated at the deadline (V8 interrupts running regex code on
 * termination, verified).
 */
import { Worker } from "node:worker_threads"

const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads")
const { pattern, flags, replacement, values } = workerData
const re = new RegExp(pattern, flags)
const out = new Array(values.length)
for (let i = 0; i < values.length; i++) out[i] = values[i].replace(re, replacement)
parentPort.postMessage(out)
`

export class RegexTimeoutError extends Error {
  constructor() {
    super("Pattern took too long to run — simplify it (fewer * / + quantifiers).")
    this.name = "RegexTimeoutError"
  }
}

export const DEFAULT_REGEX_TIMEOUT_MS = 2_000

/** `values.map(v => v.replace(new RegExp(pattern, flags), replacement))`, bounded in time and memory. */
export function replaceInWorker(
  values: string[],
  pattern: string,
  flags: string,
  replacement: string,
  timeoutMs: number = DEFAULT_REGEX_TIMEOUT_MS
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { pattern, flags, replacement, values },
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    })
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      fn()
    }
    const timer = setTimeout(() => finish(() => reject(new RegexTimeoutError())), timeoutMs)
    worker.once("message", (out: string[]) => finish(() => resolve(out)))
    worker.once("error", (error) => finish(() => reject(error)))
    worker.once("exit", (code) => {
      if (code !== 0) finish(() => reject(new Error(`Regex worker exited with code ${code}`)))
    })
  })
}
