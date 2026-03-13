"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import { Volume2 } from "lucide-react"

interface FlashcardCardProps {
  front: string
  back: string
  ipa?: string | null
  partOfSpeech?: string | null
  subtitle?: string
  onResult: (knew: boolean) => void
  index: number
  total: number
}

export function FlashcardCard({
  front,
  back,
  ipa,
  partOfSpeech,
  subtitle,
  onResult,
  index,
  total,
}: FlashcardCardProps) {
  const [flipped, setFlipped] = useState(false)
  const [exiting, setExiting] = useState<"left" | "right" | null>(null)

  const handleResult = (knew: boolean) => {
    setExiting(knew ? "right" : "left")
    setTimeout(() => {
      onResult(knew)
      setFlipped(false)
      setExiting(null)
    }, 300)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <span className="text-sm font-mono text-muted-foreground tabular-nums">
          {index + 1}/{total}
        </span>
      </div>

      {/* Card */}
      <div
        className={cn(
          "w-full aspect-[3/2] perspective-[1200px] cursor-pointer select-none transition-transform duration-300",
          exiting === "right" && "translate-x-[120%] rotate-12 opacity-0",
          exiting === "left" && "-translate-x-[120%] -rotate-12 opacity-0"
        )}
        onClick={() => setFlipped(!flipped)}
      >
        <div
          className={cn(
            "relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]",
            flipped && "[transform:rotateY(180deg)]"
          )}
        >
          {/* Front */}
          <div className="absolute inset-0 [backface-visibility:hidden] rounded-2xl border-2 border-border bg-card shadow-lg flex flex-col items-center justify-center p-8 gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {subtitle || "Tap to flip"}
            </span>
            <h2 className="text-4xl md:text-5xl font-serif font-medium text-center leading-tight">
              {front}
            </h2>
            {partOfSpeech && (
              <span className="text-sm font-mono text-primary/70 bg-primary/10 px-3 py-0.5 rounded-full">
                {partOfSpeech}
              </span>
            )}
          </div>

          {/* Back */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl border-2 border-primary/30 bg-card shadow-lg flex flex-col items-center justify-center p-8 gap-3">
            <span className="text-xs font-mono uppercase tracking-widest text-primary">
              Answer
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-medium text-center leading-tight text-primary">
              {back}
            </h2>
            {ipa && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                <span className="font-mono text-lg">/{ipa}/</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons (only visible when flipped) */}
      <div
        className={cn(
          "flex gap-4 transition-all duration-300",
          flipped ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleResult(false) }}
          className="px-8 py-3 rounded-xl bg-destructive/10 text-destructive font-medium hover:bg-destructive/20 transition-colors border border-destructive/20 text-lg"
        >
          Didn&apos;t Know
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleResult(true) }}
          className="px-8 py-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 text-lg"
        >
          Knew It! ✓
        </button>
      </div>
    </div>
  )
}
