"use client"

import { useState, useMemo, useCallback } from "react"
import { FlashcardCard } from "./flashcard-card"
import { QuizCard } from "./quiz-card"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Layers, Brain, RotateCcw, Trophy, Flame, Target, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface DictEntry {
  id: string
  lemma: string
  gloss: string
  ipa: string | null
  partOfSpeech: string | null
}

interface FlashcardSessionProps {
  entries: DictEntry[]
  languageName: string
  languageSlug: string
  isPublic?: boolean
}

type Mode = "flashcard" | "quiz"
type Direction = "conlang" | "english"
type SessionState = "setup" | "active" | "summary"

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function FlashcardSession({ entries, languageName, languageSlug, isPublic }: FlashcardSessionProps) {
  const [mode, setMode] = useState<Mode>("flashcard")
  const [direction, setDirection] = useState<Direction>("conlang")
  const [cardCount, setCardCount] = useState("25")
  const [posFilter, setPosFilter] = useState("all")
  const [sessionState, setSessionState] = useState<SessionState>("setup")

  // Session state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  // All unique POS values
  const posOptions = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(e => { if (e.partOfSpeech) set.add(e.partOfSpeech) })
    return Array.from(set).sort()
  }, [entries])

  // Filtered & shuffled deck for the session
  const deck = useMemo(() => {
    let filtered = entries
    if (posFilter !== "all") {
      filtered = entries.filter(e => e.partOfSpeech === posFilter)
    }
    const shuffled = shuffle(filtered)
    const count = cardCount === "all" ? shuffled.length : Math.min(parseInt(cardCount), shuffled.length)
    return shuffled.slice(0, count)
  }, [entries, posFilter, cardCount])

  const startSession = () => {
    setCurrentIndex(0)
    setResults([])
    setStreak(0)
    setBestStreak(0)
    setSessionState("active")
  }

  const handleResult = useCallback((correct: boolean) => {
    setResults(prev => [...prev, correct])
    if (correct) {
      setStreak(prev => {
        const newStreak = prev + 1
        setBestStreak(best => Math.max(best, newStreak))
        return newStreak
      })
    } else {
      setStreak(0)
    }

    if (currentIndex + 1 >= deck.length) {
      setTimeout(() => setSessionState("summary"), 400)
    } else {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex, deck.length])

  // Quiz mode: generate 4 options for current card
  const quizOptions = useMemo(() => {
    if (mode !== "quiz" || deck.length === 0 || currentIndex >= deck.length) return []

    const current = deck[currentIndex]
    const isConlangDirection = direction === "conlang"
    const correctAnswer = isConlangDirection ? current.gloss : current.lemma

    // Get 3 wrong answers from the pool
    const otherEntries = entries.filter(e => e.id !== current.id)
    const wrongPool = shuffle(otherEntries).slice(0, 3)
    const wrongAnswers = wrongPool.map(e => isConlangDirection ? e.gloss : e.lemma)

    // Combine and shuffle
    const options = shuffle([
      { text: correctAnswer, correct: true },
      ...wrongAnswers.map(text => ({ text, correct: false })),
    ])

    return options
  }, [mode, deck, currentIndex, direction, entries])

  const currentEntry = deck[currentIndex]

  // — SETUP SCREEN —
  if (sessionState === "setup") {
    const availableCount = posFilter === "all"
      ? entries.length
      : entries.filter(e => e.partOfSpeech === posFilter).length

    return (
      <div className="max-w-xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-serif font-medium">Study {languageName}</h1>
          <p className="text-muted-foreground">Choose your study mode and options</p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setMode("flashcard")}
            className={cn(
              "p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all",
              mode === "flashcard"
                ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                : "border-border hover:border-primary/30"
            )}
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div className="font-medium">Flashcards</div>
            <p className="text-xs text-muted-foreground text-center">Flip cards to reveal answers</p>
          </button>

          <button
            onClick={() => setMode("quiz")}
            className={cn(
              "p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all",
              mode === "quiz"
                ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                : "border-border hover:border-primary/30"
            )}
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div className="font-medium">Quiz</div>
            <p className="text-xs text-muted-foreground text-center">Multiple choice questions</p>
          </button>
        </div>

        {/* Options */}
        <Card className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v: Direction) => setDirection(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="conlang">{languageName} → English</SelectItem>
                <SelectItem value="english">English → {languageName}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Number of Cards</Label>
            <Select value={cardCount} onValueChange={setCardCount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 cards</SelectItem>
                <SelectItem value="25">25 cards</SelectItem>
                <SelectItem value="50">50 cards</SelectItem>
                <SelectItem value="all">All ({availableCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {posOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Filter by Part of Speech</Label>
              <Select value={posFilter} onValueChange={setPosFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All parts of speech</SelectItem>
                  {posOptions.map(pos => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </Card>

        <Button
          size="lg"
          className="w-full h-14 text-lg rounded-xl"
          onClick={startSession}
          disabled={availableCount < (mode === "quiz" ? 4 : 1)}
        >
          {availableCount < (mode === "quiz" ? 4 : 1)
            ? `Need at least ${mode === "quiz" ? 4 : 1} words`
            : `Start Studying (${Math.min(parseInt(cardCount) || availableCount, availableCount)} cards)`
          }
        </Button>
      </div>
    )
  }

  // — ACTIVE SESSION —
  if (sessionState === "active" && currentEntry) {
    const isConlangDirection = direction === "conlang"
    const front = isConlangDirection ? currentEntry.lemma : currentEntry.gloss
    const back = isConlangDirection ? currentEntry.gloss : currentEntry.lemma
    const subtitle = isConlangDirection ? languageName : "English"

    return (
      <div className="max-w-xl mx-auto space-y-4">
        {/* Streak counter */}
        {streak >= 3 && (
          <div className="flex items-center justify-center gap-2 text-amber-500 font-medium animate-in fade-in zoom-in duration-300">
            <Flame className="h-5 w-5" />
            <span className="text-lg">{streak} streak!</span>
          </div>
        )}

        {mode === "flashcard" ? (
          <FlashcardCard
            front={front}
            back={back}
            ipa={currentEntry.ipa}
            partOfSpeech={currentEntry.partOfSpeech}
            subtitle={subtitle}
            onResult={handleResult}
            index={currentIndex}
            total={deck.length}
          />
        ) : (
          <QuizCard
            question={front}
            options={quizOptions}
            questionLabel={`What is this in ${isConlangDirection ? "English" : languageName}?`}
            onAnswer={handleResult}
            index={currentIndex}
            total={deck.length}
          />
        )}
      </div>
    )
  }

  // — SUMMARY SCREEN —
  const correct = results.filter(Boolean).length
  const total = results.length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
  const isPerfect = accuracy === 100 && total > 0

  return (
    <div className="max-w-lg mx-auto space-y-8 text-center">
      {/* Trophy */}
      <div className="relative">
        <div className={cn(
          "h-24 w-24 mx-auto rounded-full flex items-center justify-center",
          isPerfect ? "bg-amber-500/10 ring-4 ring-amber-500/20" : "bg-primary/10 ring-4 ring-primary/20"
        )}>
          <Trophy className={cn("h-12 w-12", isPerfect ? "text-amber-500" : "text-primary")} />
        </div>
        {isPerfect && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-3xl animate-bounce">
            🎉
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-3xl font-serif font-medium">
          {isPerfect ? "Perfect Score!" : accuracy >= 70 ? "Great Job!" : "Keep Practicing!"}
        </h2>
        <p className="text-muted-foreground">
          Session complete — {languageName} {mode === "flashcard" ? "flashcards" : "quiz"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 space-y-1">
          <div className="text-3xl font-bold text-primary">{accuracy}%</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Target className="h-3 w-3" /> Accuracy
          </div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-3xl font-bold text-emerald-500">{correct}/{total}</div>
          <div className="text-xs text-muted-foreground">Correct</div>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-3xl font-bold text-amber-500">{bestStreak}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Flame className="h-3 w-3" /> Best Streak
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button size="lg" className="w-full h-12 gap-2" onClick={startSession}>
          <RotateCcw className="h-4 w-4" /> Study Again
        </Button>
        <Button size="lg" variant="outline" className="w-full h-12 gap-2" onClick={() => setSessionState("setup")}>
          <ArrowLeft className="h-4 w-4" /> Change Settings
        </Button>
          <Link
            href={isPublic ? `/lang/${languageSlug}` : `/studio/lang/${languageSlug}`}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to {isPublic ? "language page" : "studio"}
          </Link>
      </div>
    </div>
  )
}
