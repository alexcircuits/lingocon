"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import { Check, X } from "lucide-react"

interface QuizCardProps {
  question: string
  options: { text: string; correct: boolean }[]
  questionLabel?: string
  onAnswer: (correct: boolean) => void
  index: number
  total: number
}

export function QuizCard({
  question,
  options,
  questionLabel,
  onAnswer,
  index,
  total,
}: QuizCardProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)

  const handleSelect = (i: number) => {
    if (showResult) return
    setSelected(i)
    setShowResult(true)

    const correct = options[i].correct
    setTimeout(() => {
      onAnswer(correct)
      setSelected(null)
      setShowResult(false)
    }, 1200)
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

      {/* Question */}
      <div className="w-full rounded-2xl border-2 border-border bg-card shadow-lg p-8 text-center">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 block">
          {questionLabel || "What does this mean?"}
        </span>
        <h2 className="text-3xl md:text-4xl font-serif font-medium leading-tight">
          {question}
        </h2>
      </div>

      {/* Options grid */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrect = opt.correct
          const showCorrect = showResult && isCorrect
          const showWrong = showResult && isSelected && !isCorrect

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={showResult}
              className={cn(
                "relative p-4 rounded-xl border-2 text-left font-medium text-lg transition-all duration-200",
                "hover:border-primary/50 hover:bg-primary/5",
                !showResult && "border-border bg-card",
                showCorrect && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 scale-[1.02]",
                showWrong && "border-destructive bg-destructive/10 text-destructive scale-95",
                showResult && !showCorrect && !showWrong && "opacity-50 border-border bg-card"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-mono">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt.text}</span>
                {showCorrect && <Check className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
                {showWrong && <X className="h-5 w-5 text-destructive flex-shrink-0" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
