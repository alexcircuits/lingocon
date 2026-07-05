"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  parseProgram,
  applyPipeline as jsApplyPipeline,
  type SoundChangeResult,
} from "@/lib/utils/sound-change"
import { loadSoundChangeCore, type SoundChangeCore } from "./sound-change-wasm"

export interface SoundChangeEngine {
  /** True once the WASM core is loaded; false means the JS fallback is active. */
  ready: boolean
  /** Which implementation is currently serving calls. */
  source: "wasm" | "js"
  /**
   * Apply a rule pipeline to many words in one call. Uses the WASM core when
   * loaded, otherwise the pure-TS engine. Identical results either way.
   */
  batchApply: (
    words: string[],
    rulesText: string,
    vowels?: Set<string>,
    consonants?: Set<string>,
  ) => SoundChangeResult[]
}

/**
 * React hook that exposes the sound-change engine, transparently upgrading from
 * the JS fallback to the Go→WASM core once it finishes loading. The returned
 * object's identity changes when `ready` flips, so consuming `useMemo`s that
 * include the engine in their deps recompute against the faster core.
 */
export function useSoundChangeEngine(): SoundChangeEngine {
  const coreRef = useRef<SoundChangeCore | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadSoundChangeCore().then((core) => {
      if (cancelled || !core) return
      coreRef.current = core
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const batchApply = useCallback(
    (
      words: string[],
      rulesText: string,
      vowels?: Set<string>,
      consonants?: Set<string>,
    ): SoundChangeResult[] => {
      const core = coreRef.current
      if (core) {
        const v = vowels ? Array.from(vowels) : undefined
        const c = consonants ? Array.from(consonants) : undefined
        return JSON.parse(core.batchApply(words, rulesText, v, c)) as SoundChangeResult[]
      }
      // Pure-TS fallback: parse once, then map.
      const { classes, rules } = parseProgram(rulesText)
      return words.map((word) => jsApplyPipeline(word, rules, vowels, consonants, classes))
    },
    [],
  )

  return useMemo<SoundChangeEngine>(
    () => ({ ready, source: ready ? "wasm" : "js", batchApply }),
    [ready, batchApply],
  )
}
