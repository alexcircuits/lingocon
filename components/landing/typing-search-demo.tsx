"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { DEMO_ENTRIES } from "./studio-demo/demo-data"

const QUERIES = ["ae", "lum", "so", "ne"]
const VISIBLE_ROWS = 3

export function TypingSearchDemo() {
  const t = useTranslations("landing.searchDemo")
  const reduceMotion = useReducedMotion()
  const [text, setText] = useState("")
  const qIndex = useRef(0)
  const charIndex = useRef(0)
  const phase = useRef<"typing" | "hold" | "deleting">("typing")

  useEffect(() => {
    if (reduceMotion) {
      setText(QUERIES[0])
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const q = QUERIES[qIndex.current]
      if (phase.current === "typing") {
        charIndex.current += 1
        setText(q.slice(0, charIndex.current))
        if (charIndex.current >= q.length) {
          phase.current = "hold"
          timer = setTimeout(tick, 2400)
          return
        }
        timer = setTimeout(tick, 210)
      } else if (phase.current === "hold") {
        phase.current = "deleting"
        timer = setTimeout(tick, 500)
      } else {
        charIndex.current -= 1
        setText(q.slice(0, Math.max(0, charIndex.current)))
        if (charIndex.current <= 0) {
          phase.current = "typing"
          qIndex.current = (qIndex.current + 1) % QUERIES.length
          timer = setTimeout(tick, 900)
          return
        }
        timer = setTimeout(tick, 95)
      }
    }
    timer = setTimeout(tick, 1000)
    return () => clearTimeout(timer)
  }, [reduceMotion])

  const results = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!q) return DEMO_ENTRIES.slice(0, VISIBLE_ROWS)
    const matched = DEMO_ENTRIES.filter(
      (e) =>
        e.lemma.toLowerCase().includes(q) ||
        (e.gloss?.toLowerCase().includes(q) ?? false),
    )
    return (matched.length ? matched : DEMO_ENTRIES).slice(0, VISIBLE_ROWS)
  }, [text])

  const resultsKey = results.map((e) => e.id).join("-")

  return (
    <div className="flex h-full min-h-[11.5rem] flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-border/60 bg-card/80 px-4 py-2.5 shadow-sm backdrop-blur">
        <Search className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-medium text-foreground">
          {text || <span className="text-muted-foreground">{t("placeholder")}</span>}
          <span className="ml-0.5 inline-block h-4 w-[2px] -mb-0.5 animate-pulse bg-primary align-middle" />
        </span>
      </div>

      <div className="flex min-h-[9.75rem] flex-col gap-2 overflow-hidden">
        <motion.div
          key={resultsKey}
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-col gap-2"
        >
          {results.map((e) => (
            <div
              key={e.id}
              className="flex h-[2.875rem] shrink-0 items-center gap-3 rounded-xl border border-border/50 bg-card/70 px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold leading-none">{e.lemma}</span>
                  {e.ipa && (
                    <span className="font-ipa text-xs text-muted-foreground">/{e.ipa}/</span>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{e.gloss}</div>
              </div>
              {e.partOfSpeech && (
                <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {e.partOfSpeech}
                </span>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
