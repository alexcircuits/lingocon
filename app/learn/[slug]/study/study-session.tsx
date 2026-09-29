"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { submitReview, awardPerfectSession } from "@/app/actions/learn"
import { Flame, Trophy, ArrowLeft, X, Sparkles, ChevronRight, RotateCcw, BookOpen, Zap, AlertCircle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import type { RatingKey } from "@/lib/fsrs"

interface StudyCard {
  id: string
  cardType: string
  front: string
  back: string
  state: string
  reps: number
}

interface StudySessionProps {
  cards: StudyCard[]
  languageId: string
  languageSlug: string
  languageName: string
  totalDue: number
  reviewLimit: number
  newLimit: number
}

type Screen = "study" | "summary"

const RATING_LABELS: Record<RatingKey, { label: string; color: string; key: string }> = {
  AGAIN: { label: "Again",  color: "bg-red-500 hover:bg-red-600",       key: "1" },
  HARD:  { label: "Hard",   color: "bg-orange-500 hover:bg-orange-600", key: "2" },
  GOOD:  { label: "Good",   color: "bg-emerald-500 hover:bg-emerald-600", key: "3" },
  EASY:  { label: "Easy",   color: "bg-blue-500 hover:bg-blue-600",     key: "4" },
}

// Max re-queues per card within a single session
const MAX_REQUEUES = 2

export function StudySession({ cards, languageId, languageSlug, languageName, totalDue, reviewLimit, newLimit }: StudySessionProps) {
  const [queue, setQueue] = useState<StudyCard[]>(cards)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [screen, setScreen] = useState<Screen>("study")
  const [results, setResults] = useState<{ rating: RatingKey; xp: number; card: StudyCard }[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [totalXP, setTotalXP] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  // Track how many times each card has been re-queued this session
  const requeueCounts = useRef<Map<string, number>>(new Map())
  const startTimeRef = useRef<number>(Date.now())

  const current = queue[currentIdx]

  // Reset timer on new card
  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [currentIdx])

  const advance = useCallback((nextQueue: StudyCard[], nextIdx: number, isPerfect: boolean) => {
    if (nextIdx >= nextQueue.length) {
      // Session complete — streak is updated server-side per review. Award the
      // once-per-day perfect bonus only if the server actually grants it.
      if (isPerfect) {
        awardPerfectSession(languageId)
          .then((res) => {
            if (res?.data?.awarded) toast.success(`+${res.data.awarded} XP — Perfect session bonus!`)
          })
          .catch(() => {})
      }
      setScreen("summary")
    } else {
      setQueue(nextQueue)
      setCurrentIdx(nextIdx)
      setFlipped(false)
    }
  }, [languageId])

  const handleRate = useCallback(async (rating: RatingKey) => {
    if (submitting || !current) return
    setSubmitting(true)
    const timeTaken = Date.now() - startTimeRef.current

    try {
      const result = await submitReview(current.id, rating, timeTaken)
      const xpEarned = result.data?.xpEarned ?? 0

      const newResults = [...results, { rating, xp: xpEarned, card: current }]
      setResults(newResults)
      setTotalXP(prev => prev + xpEarned)

      if (rating === "AGAIN") {
        setStreak(0)
      } else {
        setStreak(prev => {
          const next = prev + 1
          setBestStreak(b => Math.max(b, next))
          return next
        })
      }

      // Re-queue AGAIN cards (up to MAX_REQUEUES times per card)
      let nextQueue = [...queue]
      if (rating === "AGAIN") {
        const count = requeueCounts.current.get(current.id) ?? 0
        if (count < MAX_REQUEUES) {
          requeueCounts.current.set(current.id, count + 1)
          nextQueue = [...queue, current]
        }
      }

      const isPerfect = newResults.every(r => r.rating !== "AGAIN")
      advance(nextQueue, currentIdx + 1, isPerfect)
    } catch {
      toast.error("Failed to save review")
    } finally {
      setSubmitting(false)
    }
  }, [current, currentIdx, queue, results, submitting, advance])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (screen !== "study" || submitting) return
      if (!flipped) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped(true) }
        return
      }
      const map: Record<string, RatingKey> = { "1": "AGAIN", "2": "HARD", "3": "GOOD", "4": "EASY" }
      if (map[e.key]) handleRate(map[e.key])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flipped, screen, submitting, handleRate])

  if (screen === "summary") {
    return (
      <SummaryScreen
        results={results}
        totalXP={totalXP}
        bestStreak={bestStreak}
        languageSlug={languageSlug}
        languageName={languageName}
        totalDue={totalDue}
        reviewLimit={reviewLimit}
        newLimit={newLimit}
      />
    )
  }

  if (!current) return null

  const progress = (currentIdx / queue.length) * 100
  const isNew = current.state === "NEW"

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground -ml-2">
          <Link href={`/learn/${languageSlug}`}>
            <X className="h-4 w-4" />
            Exit
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          {streak >= 3 && (
            <div className="flex items-center gap-1 text-amber-500 font-medium text-sm animate-in fade-in zoom-in duration-300">
              <Flame className="h-4 w-4" />
              {streak}
            </div>
          )}
          {totalXP > 0 && (
            <div className="flex items-center gap-1 text-primary font-medium text-sm">
              <Zap className="h-4 w-4" />
              +{totalXP} XP
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{currentIdx + 1} / {queue.length}</span>
        {isNew && <Badge variant="secondary" className="text-xs">New</Badge>}
      </div>

      {/* Card */}
      <div
        className={cn(
          "relative min-h-[280px] cursor-pointer rounded-3xl border-2 transition-all duration-200",
          flipped
            ? "border-primary/40 bg-card shadow-lg shadow-primary/10"
            : "border-border bg-card hover:border-primary/30 hover:shadow-md"
        )}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div className="flex flex-col items-center justify-center px-8 py-10 text-center min-h-[280px]">
          {/* Card type label */}
          <div className="absolute top-4 left-4">
            <Badge variant="outline" className="text-xs capitalize">
              {current.cardType === "VOCAB_RECOGNITION" ? "Recognize"
                : current.cardType === "VOCAB_PRODUCTION" ? "Produce"
                : current.cardType === "CLOZE" ? "Fill in"
                : "Read"}
            </Badge>
          </div>

          {!flipped ? (
            <>
              <p className="text-3xl font-bold tracking-tight mb-6">{current.front}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span>Tap to reveal</span>
                <kbd className="ml-1 rounded border border-border px-1.5 py-0.5 text-xs">Space</kbd>
              </div>
            </>
          ) : (
            <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="text-lg text-muted-foreground">{current.front}</p>
              <div className="h-px bg-border/60" />
              <p className="text-2xl font-bold tracking-tight whitespace-pre-line">{current.back}</p>
            </div>
          )}
        </div>
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div className="grid grid-cols-4 gap-2 animate-in slide-in-from-bottom-3 duration-200">
          {(Object.entries(RATING_LABELS) as [RatingKey, typeof RATING_LABELS[RatingKey]][]).map(([key, { label, color, key: kbd }]) => (
            <button
              key={key}
              onClick={() => handleRate(key)}
              disabled={submitting}
              className={cn(
                "relative rounded-2xl border-b-4 py-3 text-sm font-semibold text-white transition-all active:border-b-0 active:translate-y-[4px] disabled:opacity-50",
                color,
                key === "AGAIN" ? "border-red-700" :
                key === "HARD" ? "border-orange-700" :
                key === "GOOD" ? "border-emerald-700" :
                "border-blue-700"
              )}
            >
              {label}
              <kbd className="absolute top-1 right-1.5 rounded text-xs opacity-60">{kbd}</kbd>
            </button>
          ))}
        </div>
      )}

      {!flipped && (
        <Button className="w-full h-12 gap-2 text-base" onClick={() => setFlipped(true)}>
          <BookOpen className="h-4 w-4" />
          Reveal Answer
        </Button>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Keyboard: <kbd className="rounded border px-1">Space</kbd> reveal · <kbd className="rounded border px-1">1–4</kbd> rate
      </p>
    </div>
  )
}

function SummaryScreen({
  results, totalXP, bestStreak, languageSlug, languageName, totalDue, reviewLimit, newLimit,
}: {
  results: { rating: RatingKey; xp: number; card: StudyCard }[]
  totalXP: number
  bestStreak: number
  languageSlug: string
  languageName: string
  totalDue: number
  reviewLimit: number
  newLimit: number
}) {
  const total = results.length
  // Count each unique card once — use last rating per card
  const lastRatingByCard = new Map<string, RatingKey>()
  for (const r of results) lastRatingByCard.set(r.card.id, r.rating)

  const uniqueCards = lastRatingByCard.size
  const missedCards = results
    .filter(r => r.rating === "AGAIN")
    .filter((r, i, arr) => arr.findIndex(x => x.card.id === r.card.id) === i)

  const correct = uniqueCards - missedCards.length
  const accuracy = uniqueCards > 0 ? Math.round((correct / uniqueCards) * 100) : 0
  const isPerfect = accuracy === 100 && uniqueCards > 0
  const remaining = Math.max(0, totalDue - total)
  const [showMissed, setShowMissed] = useState(false)

  useEffect(() => {
    if (accuracy >= 70) {
      const duration = 2500
      const end = Date.now() + duration
      
      const frame = () => {
        confetti({
          disableForReducedMotion: true,
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"]
        })
        confetti({
          disableForReducedMotion: true,
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"]
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      
      frame()
    }
  }, [accuracy])

  return (
    <div className="max-w-lg mx-auto space-y-8 text-center">
      <div className="relative">
        <div className={cn(
          "h-24 w-24 mx-auto rounded-full flex items-center justify-center",
          isPerfect ? "bg-amber-500/10 ring-4 ring-amber-500/20" : "bg-primary/10 ring-4 ring-primary/20"
        )}>
          <Trophy className={cn("h-12 w-12", isPerfect ? "text-amber-500" : "text-primary")} />
        </div>
        {isPerfect && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl animate-bounce">🎉</div>
        )}
      </div>

      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {isPerfect ? "Perfect!" : accuracy >= 70 ? "Great work!" : "Keep going!"}
        </h2>
        <p className="text-muted-foreground mt-1">
          {languageName} · {uniqueCards} card{uniqueCards !== 1 ? "s" : ""} reviewed
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox value={`${accuracy}%`} label="Accuracy" color="text-primary" />
        <StatBox value={`+${totalXP}`} label="XP Earned" color="text-amber-500" icon={<Zap className="h-3 w-3" />} />
        <StatBox value={bestStreak.toString()} label="Best Streak" color="text-orange-500" icon={<Flame className="h-3 w-3" />} />
      </div>

      {/* Missed cards review */}
      {missedCards.length > 0 && (
        <div className="text-left">
          <button
            onClick={() => setShowMissed(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <AlertCircle className="h-4 w-4 text-red-500" />
            {missedCards.length} card{missedCards.length !== 1 ? "s" : ""} to review
            <ChevronRight className={cn("h-4 w-4 transition-transform", showMissed && "rotate-90")} />
          </button>
          {showMissed && (
            <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
              {missedCards.map(r => (
                <div key={r.card.id} className="rounded-xl border border-red-200/50 bg-red-50/30 dark:bg-red-950/20 dark:border-red-900/30 px-4 py-3 text-sm">
                  <span className="font-medium">{r.card.front}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="text-muted-foreground">{r.card.back}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {remaining > 0 && (
          <Button asChild size="lg" className="w-full h-12 gap-2">
            <Link href={`/learn/${languageSlug}/study?review=${reviewLimit}&new=${newLimit}`}>
              <Sparkles className="h-4 w-4" />
              Continue ({remaining} more due)
            </Link>
          </Button>
        )}

        {/* Session-size picker */}
        {remaining > 0 && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Session size:</span>
            {([10, 20, 50] as const).map(n => {
              const r = Math.round(n * 0.7)
              const nw = n - r
              const active = reviewLimit === r && newLimit === nw
              return (
                <Link
                  key={n}
                  href={`/learn/${languageSlug}/study?review=${r}&new=${nw}`}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {n}
                </Link>
              )
            })}
          </div>
        )}

        <Button asChild size="lg" variant={remaining > 0 ? "outline" : "default"} className="w-full h-12 gap-2">
          <Link href={`/learn/${languageSlug}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to {languageName}
          </Link>
        </Button>
      </div>
    </div>
  )
}

function StatBox({ value, label, color, icon }: { value: string; label: string; color: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-4 text-center space-y-1">
      <div className={cn("text-2xl font-bold flex items-center justify-center gap-1", color)}>
        {icon}
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  )
}
