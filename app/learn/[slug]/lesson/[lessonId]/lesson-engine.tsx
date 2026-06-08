"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { completeLesson } from "@/app/actions/learn"
import {
  X, Heart, HeartCrack, Trophy, ArrowLeft, Sparkles,
  CheckCircle2, XCircle, RotateCcw, Zap, BookOpen, FileText, ExternalLink, Target, Languages,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import type { Exercise, MultipleChoiceExercise, TranslateExercise, MatchPairsExercise, SentenceBuilderExercise, InfoExercise, WordIntroExercise } from "@/types/lesson"
import { FontLoader } from "@/components/font-loader"

type ScriptSymbol = { symbol: string; latin: string | null }

function romanize(text: string, symbols: ScriptSymbol[]): string {
  const map = new Map(symbols.filter(s => s.latin).map(s => [s.symbol, s.latin!]))
  return text.split("").map(c => map.get(c) ?? c).join("")
}

// ─── XP config ────────────────────────────────────────────────────────────────

const BASE_LESSON_XP = 10
const XP_PER_HEART   = 5   // bonus per heart remaining at completion
const MAX_HEARTS     = 3

// ─── Levenshtein fuzzy match ──────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "")
}

function normalizeForCompare(s: string): string {
  return stripDiacritics(s.trim().toLowerCase())
}

function matchWithTolerance(rawInput: string, target: string): boolean {
  const a = normalizeForCompare(rawInput)
  const b = normalizeForCompare(target)
  if (a === b) return true
  // Allow 1 typo for words longer than 4 chars, 2 for words longer than 8
  const tolerance = b.length <= 4 ? 0 : b.length <= 8 ? 1 : 2
  return levenshtein(a, b) <= tolerance
}

function isAnswerCorrect(
  userInput: string,
  expected: string,
  options?: { acceptRomanized?: boolean; scriptSymbols?: ScriptSymbol[] },
): boolean {
  const raw = userInput.trim().toLowerCase()
  const target = expected.trim().toLowerCase()
  if (raw === target) return true
  // Diacritic-insensitive compare: a missed combining mark shouldn't fail
  // the learner. Normalize both sides before measuring edit distance.
  if (matchWithTolerance(raw, target)) return true

  // Optional: accept the Latin transliteration of the expected answer as
  // correct. Opt-in per language because for many conlangs the romanization
  // is lossy or ambiguous (Luna's case in #bug-reports).
  if (options?.acceptRomanized && options.scriptSymbols && options.scriptSymbols.length > 0) {
    const romanizedTarget = romanize(target, options.scriptSymbols).toLowerCase()
    if (romanizedTarget && romanizedTarget !== target && matchWithTolerance(raw, romanizedTarget)) {
      return true
    }
  }

  return false
}

// ─── Props / State types ──────────────────────────────────────────────────────

interface LessonEngineProps {
  lessonId: string
  lessonTitle: string
  exercises: Exercise[]
  languageSlug: string
  languageName: string
  courseId: string
  fontUrl?: string | null
  fontFamily?: string | null
  fontScale?: number
  scriptSymbols: ScriptSymbol[]
  acceptRomanizedAnswers?: boolean
}

type FeedbackState =
  | { status: "answering" }
  | { status: "correct"; correctText: string; hint?: string }
  | { status: "wrong";   correctText: string; hint?: string }

type Screen = "lesson" | "complete" | "failed"

// ─── Main engine ──────────────────────────────────────────────────────────────

export function LessonEngine({
  lessonId, lessonTitle, exercises, languageSlug, languageName, courseId,
  fontUrl, fontFamily, fontScale, scriptSymbols, acceptRomanizedAnswers = false,
}: LessonEngineProps) {
  const t = useTranslations("learn.engine")
  const [queue, setQueue]         = useState<Exercise[]>(exercises)
  const [idx, setIdx]             = useState(0)
  const [hearts, setHearts]       = useState(MAX_HEARTS)
  const [feedback, setFeedback]   = useState<FeedbackState>({ status: "answering" })
  const [screen, setScreen]       = useState<Screen>("lesson")
  const [correctCount, setCorrect] = useState(0)
  const [wrongCount, setWrong]    = useState(0)
  const [selected, setSelected]   = useState<string | null>(null)  // MC selected option id
  const [typedAnswer, setTyped]   = useState("")
  const [selectedBuilderWords, setSelectedBuilderWords] = useState<string[]>([])
  const [saving, setSaving]       = useState(false)
  const [awardedXp, setAwardedXp] = useState<number | null>(null)
  const [mistakes, setMistakes]   = useState<Exercise[]>([])
  const [reviewMode, setReviewMode] = useState(false)
  const [showRoman, setShowRoman] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const baseExerciseId = (id: string) => id.replace(/-(retry|review).*$/, "")
  const recordMistake = useCallback((ex: Exercise) => {
    const base = baseExerciseId(ex.id)
    setMistakes(prev =>
      prev.some(m => baseExerciseId(m.id) === base) ? prev : [...prev, { ...ex, id: `${base}-review` }],
    )
  }, [])

  const current = queue[idx]
  const progress = exercises.length > 0 ? idx / (queue.length) : 1

  // Focus input when a TRANSLATE card appears
  useEffect(() => {
    if (current?.type === "TRANSLATE" && feedback.status === "answering") {
      inputRef.current?.focus()
    }
    setSelected(null)
    setTyped("")
    setSelectedBuilderWords([])
  }, [idx, current?.type, feedback.status])

  // ── Check answer ──────────────────────────────────────────────────────────

  const checkAnswer = useCallback(() => {
    if (!current || feedback.status !== "answering") return

    let correct = false
    let correctText = ""
    let hint: string | undefined

    if (current.type === "MULTIPLE_CHOICE") {
      const option = current.options.find(o => o.id === selected)
      correct = option?.correct ?? false
      correctText = current.options.find(o => o.correct)?.text ?? ""
    } else if (current.type === "TRANSLATE") {
      correct = isAnswerCorrect(typedAnswer, current.answer, {
        acceptRomanized: acceptRomanizedAnswers,
        scriptSymbols,
      })
      correctText = current.answer
      hint = current.hint
    } else if (current.type === "SENTENCE_BUILDER") {
      const selectedTexts = selectedBuilderWords.map(id => current.words.find(w => w.id === id)?.text).join(" ")
      correct = isAnswerCorrect(selectedTexts, current.sentence, {
        acceptRomanized: acceptRomanizedAnswers,
        scriptSymbols,
      })
      correctText = current.sentence
    }

    if (correct) {
      setCorrect(c => c + 1)
      setFeedback({ status: "correct", correctText, hint })
    } else {
      setWrong(w => w + 1)
      recordMistake(current)
      const newHearts = hearts - 1
      setHearts(newHearts)
      setFeedback({ status: "wrong", correctText, hint })
      if (newHearts === 0) {
        // Delay so user sees the wrong feedback before fail screen
        setTimeout(() => setScreen("failed"), 1400)
      }
    }
  }, [current, feedback.status, selected, typedAnswer, hearts, selectedBuilderWords, recordMistake, acceptRomanizedAnswers, scriptSymbols])

  // ── Match-pairs wrong match — counts toward accuracy but doesn't cost a
  // heart. Match-pairs is a warm-up; the production round is where mistakes
  // bite. This keeps the early lesson learner-friendly.

  const handleMatchWrong = useCallback(() => {
    setWrong(w => w + 1)
  }, [])

  // ── Advance to next exercise ───────────────────────────────────────────────

  const advance = useCallback(async () => {
    // Track the *effective* queue length so end-of-lesson detection is correct
    // even when we just enqueued a retry card.
    let effectiveQueueLength = queue.length

    if (feedback.status === "wrong" && hearts > 0) {
      // Re-queue the card near the end so learner sees it again
      const failed = queue[idx]
      const newQueue = [...queue]
      const insertAt = Math.min(idx + 3, newQueue.length)
      newQueue.splice(insertAt, 0, { ...failed, id: `${failed.id}-retry` } as Exercise)
      setQueue(newQueue)
      effectiveQueueLength = newQueue.length
    }

    const nextIdx = idx + 1
    if (nextIdx >= effectiveQueueLength || (feedback.status === "wrong" && hearts === 0)) {
      // Reviewing past mistakes never re-awards XP or re-saves completion.
      if (reviewMode) {
        setScreen("complete")
        return
      }
      // All done — save completion. XP is computed and returned by the server.
      setSaving(true)
      try {
        const result = await completeLesson(lessonId, hearts)
        if (result?.error) {
          toast.error(result.error)
        } else {
          setAwardedXp(result?.data?.xpEarned ?? 0)
          setScreen("complete")
        }
      } catch {
        toast.error(t("failedToSaveProgress"))
      } finally {
        setSaving(false)
      }
      return
    }

    setIdx(nextIdx)
    setFeedback({ status: "answering" })
  }, [feedback.status, hearts, idx, lessonId, queue, reviewMode])

  // ── Review just the mistakes from this session ─────────────────────────────

  const startReview = useCallback(() => {
    if (mistakes.length === 0) return
    setQueue(mistakes)
    setMistakes([])
    setIdx(0)
    setHearts(MAX_HEARTS)
    setCorrect(0)
    setWrong(0)
    setReviewMode(true)
    setFeedback({ status: "answering" })
    setSelected(null)
    setTyped("")
    setSelectedBuilderWords([])
    setScreen("lesson")
  }, [mistakes])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (screen !== "lesson") return
      if (feedback.status === "answering") {
        if (current?.type === "MULTIPLE_CHOICE") {
          const keyMap: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 }
          if (e.key in keyMap) {
            const opt = current.options[keyMap[e.key]]
            if (opt) setSelected(opt.id)
          }
          if ((e.key === "Enter" || e.key === " ") && selected) {
            e.preventDefault()
            checkAnswer()
          }
        }
        if (current?.type === "TRANSLATE" && e.key === "Enter") {
          e.preventDefault()
          if (typedAnswer.trim()) checkAnswer()
        }
        if ((current?.type === "INFO" || current?.type === "WORD_INTRO") && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          advance()
        }
      } else {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          advance()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [screen, feedback.status, current, selected, typedAnswer, checkAnswer, advance])

  // ── Screens ───────────────────────────────────────────────────────────────

  if (screen === "complete") {
    const xpEarned = awardedXp ?? (BASE_LESSON_XP + XP_PER_HEART * Math.max(0, hearts))
    const totalAttempts = correctCount + wrongCount
    const accuracy = totalAttempts > 0
      ? Math.round((correctCount / totalAttempts) * 100)
      : 0
    return (
      <CompleteScreen
        lessonTitle={lessonTitle}
        xpEarned={xpEarned}
        heartsLeft={hearts}
        maxHearts={MAX_HEARTS}
        accuracy={accuracy}
        languageSlug={languageSlug}
        languageName={languageName}
        courseId={courseId}
        reviewMode={reviewMode}
        mistakeCount={mistakes.length}
        onReviewMistakes={startReview}
      />
    )
  }

  if (screen === "failed") {
    return (
      <FailedScreen
        lessonTitle={lessonTitle}
        lessonId={lessonId}
        languageSlug={languageSlug}
        courseId={courseId}
      />
    )
  }

  if (!current) return null

  // ── Render exercise ───────────────────────────────────────────────────────

  const canCheck =
    (current.type === "MULTIPLE_CHOICE" && selected !== null) ||
    (current.type === "TRANSLATE" && typedAnswer.trim().length > 0) ||
    (current.type === "SENTENCE_BUILDER" && selectedBuilderWords.length > 0)

  return (
    <div className="flex flex-col min-h-screen">
      <FontLoader fontUrl={fontUrl} fontFamily={fontFamily} fontScale={fontScale} />

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="container mx-auto max-w-2xl px-4 py-3 flex items-center gap-4">
          <Link href={`/learn/${languageSlug}/courses/${courseId}`} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </Link>

          {/* Progress bar */}
          <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>

          {/* Romanization toggle — shown when there's a custom font or latin mappings */}
          {(fontFamily || scriptSymbols.some(s => s.latin)) && (
            <button
              onClick={() => setShowRoman(p => !p)}
              className={cn(
                "flex items-center rounded-lg p-1.5 transition-colors",
                showRoman ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
              title={showRoman ? t("toggleRomanHide") : t("toggleRomanShow")}
            >
              <Languages className="h-4 w-4" />
            </button>
          )}

          {/* Hearts */}
          <div className="flex items-center gap-1">
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <span key={i} className={cn(
                "transition-all duration-300",
                i < hearts ? "text-red-500 scale-100" : "text-muted-foreground/30 scale-90"
              )}>
                {i < hearts ? <Heart className="h-5 w-5 fill-current" /> : <Heart className="h-5 w-5" />}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Exercise area ── */}
      <div className="flex-1 container mx-auto max-w-2xl px-4 py-8">
        {current.type === "MATCH_PAIRS" ? (
          <MatchPairsCard
            exercise={current}
            scriptSymbols={scriptSymbols}
            showRoman={showRoman}
            onWrong={handleMatchWrong}
            onComplete={() => {
              if (hearts === 0) return
              const nextIdx = idx + 1
              if (nextIdx >= queue.length) {
                setSaving(true)
                completeLesson(lessonId, hearts)
                  .then((result) => {
                    if (result?.error) {
                      toast.error(result.error)
                      return
                    }
                    setAwardedXp(result?.data?.xpEarned ?? 0)
                    setScreen("complete")
                  })
                  .catch(() => toast.error(t("failedToSaveProgress")))
                  .finally(() => setSaving(false))
              } else {
                setIdx(nextIdx)
                setFeedback({ status: "answering" })
              }
            }}
          />
        ) : (
          <div className="space-y-8">
            {current.type === "INFO" && (
              <InfoCard exercise={current} />
            )}
            {current.type === "WORD_INTRO" && (
              <WordIntroCard
                exercise={current}
                scriptSymbols={scriptSymbols}
                showRoman={showRoman}
              />
            )}
            {current.type === "MULTIPLE_CHOICE" && (
              <MultipleChoiceCard
                exercise={current}
                selected={selected}
                feedback={feedback}
                onSelect={setSelected}
                scriptSymbols={scriptSymbols}
                showRoman={showRoman}
              />
            )}
            {current.type === "TRANSLATE" && (
              <TranslateCard
                exercise={current}
                value={typedAnswer}
                feedback={feedback}
                onChange={setTyped}
                onSubmit={checkAnswer}
                inputRef={inputRef}
                scriptSymbols={scriptSymbols}
                showRoman={showRoman}
              />
            )}
            {current.type === "SENTENCE_BUILDER" && (
              <SentenceBuilderCard
                exercise={current}
                selectedWords={selectedBuilderWords}
                onSelect={setSelectedBuilderWords}
                feedback={feedback}
                scriptSymbols={scriptSymbols}
                showRoman={showRoman}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Bottom action / feedback bar ── */}
      {current.type !== "MATCH_PAIRS" && (
        <div
          className={cn(
            "sticky bottom-0 border-t transition-colors duration-300",
            feedback.status === "correct" ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
              : feedback.status === "wrong" ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
              : "bg-background border-border"
          )}
          // Keep the Check / Continue button clear of iOS home-indicator and
          // the Chrome bottom URL bar. Without this the button can be hidden on
          // mobile, which looks like "the lesson won't let me complete".
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="container mx-auto max-w-2xl px-4 py-4">
            {feedback.status === "answering" ? (
              current.type === "INFO" || current.type === "WORD_INTRO" ? (
                <Button
                  size="lg"
                  className="w-full h-12 text-base font-semibold"
                  onClick={advance}
                  disabled={saving}
                >
                  {t("continue")}
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full h-12 text-base font-semibold"
                  disabled={!canCheck}
                  onClick={checkAnswer}
                >
                  {t("check")}
                </Button>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  {feedback.status === "correct" ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={cn(
                      "font-semibold text-lg",
                      feedback.status === "correct" ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
                    )}>
                      {feedback.status === "correct" ? t("correct") : t("incorrect")}
                    </p>
                    {feedback.status === "wrong" && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {t("correctAnswer")} <span className="font-semibold text-foreground">{feedback.correctText}</span>
                        {feedback.hint && <span className="text-muted-foreground ml-2">{feedback.hint}</span>}
                      </p>
                    )}
                    {feedback.status === "correct" && feedback.hint && (
                      <p className="text-sm text-muted-foreground mt-0.5">{feedback.hint}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="lg"
                  className={cn(
                    "w-full h-12 text-base font-semibold",
                    feedback.status === "correct"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  )}
                  onClick={advance}
                  disabled={saving}
                >
                  Continue
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Word Intro Card ──────────────────────────────────────────────────────────

function WordIntroCard({
  exercise, scriptSymbols, showRoman,
}: {
  exercise: WordIntroExercise
  scriptSymbols: ScriptSymbol[]
  showRoman: boolean
}) {
  const t = useTranslations("learn.engine")
  const [revealed, setRevealed] = useState(false)
  // Each new intro card resets reveal state.
  useEffect(() => { setRevealed(false) }, [exercise.id])

  const useScriptFont = !showRoman
  const roman = showRoman ? romanize(exercise.word, scriptSymbols) : null

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {t("newWord")}
        </span>
      </div>

      <div className="rounded-3xl border-2 border-border bg-card p-8 text-center space-y-4">
        <p className={cn("text-6xl font-bold tracking-tight", useScriptFont && "font-custom-script")}>
          {exercise.word}
        </p>
        {roman && roman !== exercise.word && (
          <p className="text-2xl text-muted-foreground">{roman}</p>
        )}
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
          {exercise.ipa && <span className="font-mono">/{exercise.ipa}/</span>}
          {exercise.ipa && exercise.partOfSpeech && <span aria-hidden>·</span>}
          {exercise.partOfSpeech && <span className="italic">{exercise.partOfSpeech}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        disabled={revealed}
        className={cn(
          "w-full rounded-2xl border-2 border-b-4 px-5 py-5 text-lg font-semibold transition-all duration-150",
          "active:border-b-2 active:translate-y-[2px] disabled:cursor-default",
          revealed
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
            : "border-border bg-card hover:border-primary/40 hover:bg-primary/5 text-foreground",
        )}
        aria-label={revealed ? t("translationRevealed") : t("tapToReveal")}
      >
        {revealed ? exercise.gloss : t("tapToReveal")}
      </button>

      {revealed && exercise.example && (
        <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm space-y-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <p className={cn("font-semibold", useScriptFont && "font-custom-script")}>
            {exercise.example.sentence}
          </p>
          <p className="text-muted-foreground">{exercise.example.translation}</p>
        </div>
      )}
    </div>
  )
}

// ─── Multiple Choice Card ─────────────────────────────────────────────────────

function MultipleChoiceCard({
  exercise, selected, feedback, onSelect, scriptSymbols, showRoman,
}: {
  exercise: MultipleChoiceExercise
  selected: string | null
  feedback: FeedbackState
  onSelect: (id: string) => void
  scriptSymbols: ScriptSymbol[]
  showRoman: boolean
}) {
  const isConlangWord = exercise.direction === "to_native"
  const useScriptFont = isConlangWord && !showRoman
  const roman = isConlangWord && showRoman ? romanize(exercise.word, scriptSymbols) : null
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          {exercise.prompt}
        </p>
        <p className={cn("text-5xl font-bold tracking-tight", useScriptFont && "font-custom-script")}>{exercise.word}</p>
        {roman && roman !== exercise.word && (
          <p className="text-xl text-muted-foreground mt-2">{roman}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {exercise.options.map((option, i) => {
          const isSelected = selected === option.id
          const isRevealed = feedback.status !== "answering"
          const isCorrect  = option.correct
          const isWrong    = isSelected && !isCorrect && isRevealed

          return (
            <button
              key={option.id}
              onClick={() => feedback.status === "answering" && onSelect(option.id)}
              disabled={isRevealed}
              className={cn(
                "relative text-left rounded-2xl border-2 border-b-4 px-5 py-4 text-base font-medium transition-all duration-150",
                "disabled:cursor-default active:border-b-2 active:translate-y-[2px]",
                // Default state
                !isSelected && !isRevealed && "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
                // Selected but not yet checked
                isSelected && !isRevealed && "border-primary bg-primary/10 text-primary border-primary/50",
                // Revealed correct
                isCorrect && isRevealed && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
                // Revealed wrong selection
                isWrong && "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 animate-shake",
                // Unselected after reveal
                !isSelected && !isCorrect && isRevealed && "border-border bg-card opacity-50",
              )}
            >
              <span className="absolute top-3 right-3 text-xs text-muted-foreground/60 font-mono">
                {i + 1}
              </span>
              {option.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Translate Card ───────────────────────────────────────────────────────────

function TranslateCard({
  exercise, value, feedback, onChange, onSubmit, inputRef, scriptSymbols, showRoman,
}: {
  exercise: TranslateExercise
  value: string
  feedback: FeedbackState
  onChange: (v: string) => void
  onSubmit: () => void
  inputRef: React.RefObject<HTMLInputElement>
  scriptSymbols: ScriptSymbol[]
  showRoman: boolean
}) {
  const t = useTranslations("learn.engine")
  const revealed = feedback.status !== "answering"
  const isConlangWord = exercise.direction === "to_native"
  const useScriptFont = isConlangWord && !showRoman
  const roman = isConlangWord && showRoman ? romanize(exercise.word, scriptSymbols) : null

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          {exercise.prompt}
        </p>
        <p className={cn("text-5xl font-bold tracking-tight", useScriptFont && "font-custom-script")}>{exercise.word}</p>
        {roman && roman !== exercise.word && (
          <p className="text-xl text-muted-foreground mt-2">{roman}</p>
        )}
        {exercise.hint && (
          <p className="text-sm text-muted-foreground mt-3 font-mono">{exercise.hint}</p>
        )}
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => !revealed && onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && value.trim() && !revealed && onSubmit()}
          disabled={revealed}
          placeholder={t("typeYourAnswer")}
          className={cn(
            "w-full rounded-2xl border-2 bg-card px-5 py-4 text-xl font-medium outline-none transition-all",
            "placeholder:text-muted-foreground/40 disabled:cursor-default",
            !revealed && "border-border focus:border-primary",
            feedback.status === "correct" && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
            feedback.status === "wrong" && "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 line-through",
          )}
        />
        {feedback.status === "wrong" && (
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg px-1 animate-in fade-in slide-in-from-top-1 duration-200">
            {exercise.answer}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Info / Concept Card ──────────────────────────────────────────────────────

function InfoCard({ exercise }: { exercise: InfoExercise }) {
  const t = useTranslations("learn.engine")
  const isGrammar = exercise.kind === "GRAMMAR"
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          isGrammar ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600",
        )}>
          {isGrammar ? <BookOpen className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>
        <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {isGrammar ? t("grammarLabel") : t("readingLabel")}
        </span>
      </div>

      <h2 className="text-3xl font-bold tracking-tight">{exercise.title}</h2>

      {exercise.body ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-base leading-relaxed text-muted-foreground whitespace-pre-line">
          {exercise.body}
        </div>
      ) : (
        <p className="text-muted-foreground">{t("openFullPage")}</p>
      )}

      {exercise.href && (
        <Link
          href={exercise.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          {isGrammar ? t("readFullGrammar") : t("openFullText")}
        </Link>
      )}
    </div>
  )
}

// ─── Match Pairs Card ─────────────────────────────────────────────────────────

function MatchPairsCard({
  exercise, onComplete, onWrong, scriptSymbols, showRoman,
}: {
  exercise: MatchPairsExercise
  onComplete: () => void
  onWrong: () => void
  scriptSymbols: ScriptSymbol[]
  showRoman: boolean
}) {
  const t = useTranslations("learn.engine")
  const [selectedLeft, setSelectedLeft]   = useState<string | null>(null)
  const [selectedRight, setSelectedRight] = useState<string | null>(null)
  const [matched, setMatched]             = useState<Set<string>>(new Set())
  const [shaking, setShaking]             = useState<string | null>(null)

  // Shuffle right column independently
  const [rightOrder] = useState(() =>
    [...exercise.pairs].sort(() => Math.random() - 0.5)
  )

  useEffect(() => {
    if (matched.size === exercise.pairs.length) {
      // Brief pause before advancing
      const timer = setTimeout(onComplete, 600)
      return () => clearTimeout(timer)
    }
  }, [matched.size, exercise.pairs.length, onComplete])

  function tryMatch(leftId: string, rightId: string) {
    if (leftId === rightId) {
      // Correct match
      setMatched(prev => new Set([...prev, leftId]))
      setSelectedLeft(null)
      setSelectedRight(null)
    } else {
      // Wrong — costs a heart, shake both, then clear
      onWrong()
      setShaking(leftId)
      setTimeout(() => {
        setShaking(null)
        setSelectedLeft(null)
        setSelectedRight(null)
      }, 500)
    }
  }

  function handleLeft(id: string) {
    if (matched.has(id)) return
    setSelectedLeft(id)
    if (selectedRight) tryMatch(id, selectedRight)
  }

  function handleRight(id: string) {
    if (matched.has(id)) return
    setSelectedRight(id)
    if (selectedLeft) tryMatch(selectedLeft, id)
  }

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {t("matchPairs")}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Left column — conlang words */}
        <div className="space-y-3">
          {exercise.pairs.map(pair => {
            const isMatched   = matched.has(pair.id)
            const isSelected  = selectedLeft === pair.id
            const isShaking   = shaking === pair.id

            return (
              <button
                key={`L-${pair.id}`}
                onClick={() => handleLeft(pair.id)}
                disabled={isMatched}
                className={cn(
                  "w-full rounded-2xl border-2 border-b-4 px-4 py-3 text-sm font-semibold transition-all duration-150",
                  "disabled:cursor-default text-center active:border-b-2 active:translate-y-[2px]",
                  isMatched   && "border-emerald-400 border-b-2 translate-y-[2px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 scale-95 opacity-60",
                  isSelected  && !isMatched && "border-primary bg-primary/10 text-primary scale-105 border-primary/50",
                  isShaking   && "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-600 animate-shake",
                  !isSelected && !isMatched && !isShaking && "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className={cn(!showRoman && "font-custom-script")}>{pair.left}</span>
                {showRoman && (() => { const r = romanize(pair.left, scriptSymbols); return r !== pair.left ? <span className="block text-xs font-normal opacity-70 mt-0.5">{r}</span> : null })()}
              </button>
            )
          })}
        </div>

        {/* Right column — native glosses (shuffled) */}
        <div className="space-y-3">
          {rightOrder.map(pair => {
            const isMatched  = matched.has(pair.id)
            const isSelected = selectedRight === pair.id
            const isShaking  = shaking === pair.id

            return (
              <button
                key={`R-${pair.id}`}
                onClick={() => handleRight(pair.id)}
                disabled={isMatched}
                className={cn(
                  "w-full rounded-2xl border-2 border-b-4 px-4 py-3 text-sm font-semibold transition-all duration-150",
                  "disabled:cursor-default text-center active:border-b-2 active:translate-y-[2px]",
                  isMatched   && "border-emerald-400 border-b-2 translate-y-[2px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 scale-95 opacity-60",
                  isSelected  && !isMatched && "border-primary bg-primary/10 text-primary scale-105 border-primary/50",
                  isShaking   && "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-600 animate-shake",
                  !isSelected && !isMatched && !isShaking && "border-border bg-card hover:border-primary/40",
                )}
              >
                {pair.right}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Sentence Builder Card ────────────────────────────────────────────────────

function SentenceBuilderCard({
  exercise,
  selectedWords,
  onSelect,
  feedback,
  scriptSymbols,
  showRoman,
}: {
  exercise: SentenceBuilderExercise
  selectedWords: string[]
  onSelect: (words: string[]) => void
  feedback: FeedbackState
  scriptSymbols: ScriptSymbol[]
  showRoman: boolean
}) {
  const t = useTranslations("learn.engine")
  const isRevealed = feedback.status !== "answering"

  const handleBankClick = (id: string) => {
    if (isRevealed || selectedWords.includes(id)) return
    onSelect([...selectedWords, id])
  }

  const handleLineClick = (id: string) => {
    if (isRevealed) return
    onSelect(selectedWords.filter(w => w !== id))
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          {t("translateSentence")}
        </p>
        <p className="text-3xl font-bold tracking-tight">{exercise.prompt}</p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Answer Line */}
        <div className="min-h-[60px] border-b-2 border-border/60 flex flex-wrap gap-2 pb-2">
          {selectedWords.map(id => {
            const word = exercise.words.find(w => w.id === id)
            if (!word) return null
            return (
              <button
                key={`line-${id}`}
                onClick={() => handleLineClick(id)}
                className={cn(
                  "rounded-2xl border-2 border-b-4 px-4 py-2 text-base font-medium transition-all",
                  "bg-card hover:bg-muted active:border-b-2 active:translate-y-[2px]",
                  isRevealed && "pointer-events-none opacity-80"
                )}
              >
                <span className={cn(!showRoman && "font-custom-script")}>{word.text}</span>
                {(() => { const r = romanize(word.text, scriptSymbols); return r !== word.text ? <span className="block text-xs font-normal opacity-60">{r}</span> : null })()}
              </button>
            )
          })}
        </div>

        {/* Word Bank */}
        <div className="flex flex-wrap gap-3 justify-center min-h-[120px]">
          {exercise.words.map(word => {
            const isSelected = selectedWords.includes(word.id)
            return (
              <button
                key={`bank-${word.id}`}
                onClick={() => handleBankClick(word.id)}
                disabled={isSelected || isRevealed}
                className={cn(
                  "rounded-2xl border-2 border-b-4 px-4 py-2 text-base font-medium transition-all duration-150",
                  "bg-card active:border-b-2 active:translate-y-[2px] disabled:cursor-default",
                  isSelected ? "bg-muted text-muted border-border/40 opacity-0 pointer-events-none scale-90" : "hover:border-primary/40 text-foreground"
                )}
              >
                <span className={cn(!showRoman && "font-custom-script")}>{word.text}</span>
                {(() => { const r = romanize(word.text, scriptSymbols); return r !== word.text ? <span className="block text-xs font-normal opacity-60">{r}</span> : null })()}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Completion Screen ────────────────────────────────────────────────────────

function CompleteScreen({
  lessonTitle, xpEarned, heartsLeft, maxHearts, accuracy, languageSlug, languageName, courseId,
  reviewMode, mistakeCount, onReviewMistakes,
}: {
  lessonTitle: string
  xpEarned: number
  heartsLeft: number
  maxHearts: number
  accuracy: number
  languageSlug: string
  languageName: string
  courseId: string
  reviewMode: boolean
  mistakeCount: number
  onReviewMistakes: () => void
}) {
  const t = useTranslations("learn.engine")
  const isPerfect = heartsLeft === maxHearts

  useEffect(() => {
    const duration = 2500
    const end = Date.now() + duration
    
    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"]
      })
      confetti({
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
  }, [])

  return (
    <div className="container mx-auto max-w-md px-4 py-16 flex flex-col items-center text-center gap-8">
      {/* Trophy */}
      <div className="relative">
        <div className={cn(
          "h-28 w-28 rounded-full flex items-center justify-center mx-auto",
          isPerfect
            ? "bg-amber-500/10 ring-4 ring-amber-500/20"
            : "bg-primary/10 ring-4 ring-primary/20"
        )}>
          <Trophy className={cn("h-14 w-14", isPerfect ? "text-amber-500" : "text-primary")} />
        </div>
        {isPerfect && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-4xl animate-bounce">🎉</span>
        )}
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {reviewMode ? t("mistakesReviewed") : isPerfect ? t("flawless") : accuracy >= 70 ? t("lessonComplete") : t("wellDone")}
        </h1>
        <p className="text-muted-foreground mt-1">{lessonTitle}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 w-full">
        <StatTile
          label={t("statAccuracy")}
          value={`${accuracy}%`}
          color="text-primary"
        />
        <StatTile
          label={t("statXpEarned")}
          value={`+${xpEarned}`}
          color="text-amber-500"
          icon={<Zap className="h-4 w-4" />}
        />
        <StatTile
          label={t("statHearts")}
          value={`${heartsLeft}/${maxHearts}`}
          color="text-red-500"
          icon={<Heart className="h-4 w-4 fill-current" />}
        />
      </div>

      <div className="flex flex-col gap-3 w-full">
        {mistakeCount > 0 && (
          <Button size="lg" className="h-12 gap-2 bg-amber-500 hover:bg-amber-600 text-white" onClick={onReviewMistakes}>
            <Target className="h-4 w-4" />
            {t("reviewMistakes", { count: mistakeCount })}
          </Button>
        )}
        <Button asChild size="lg" variant={mistakeCount > 0 ? "outline" : "default"} className="h-12 gap-2">
          <Link href={`/learn/${languageSlug}/courses/${courseId}`}>
            <ArrowLeft className="h-4 w-4" />
            {t("backToCourse")}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 gap-2">
          <Link href={`/learn/${languageSlug}/study`}>
            <Sparkles className="h-4 w-4" />
            {t("practiceSrs")}
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ─── Failed Screen ────────────────────────────────────────────────────────────

function FailedScreen({
  lessonTitle, lessonId, languageSlug, courseId,
}: {
  lessonTitle: string
  lessonId: string
  languageSlug: string
  courseId: string
}) {
  const t = useTranslations("learn.engine")
  return (
    <div className="container mx-auto max-w-md px-4 py-16 flex flex-col items-center text-center gap-8">
      <div className="h-28 w-28 rounded-full bg-red-500/10 ring-4 ring-red-500/20 flex items-center justify-center mx-auto">
        <HeartCrack className="h-14 w-14 text-red-500" />
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("outOfHearts")}</h1>
        <p className="text-muted-foreground mt-1">{lessonTitle}</p>
        <p className="text-muted-foreground text-sm mt-2">
          {t("outOfHeartsHint")}
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Button asChild size="lg" className="h-12 gap-2">
          <Link href={`/learn/${languageSlug}/lesson/${lessonId}`}>
            <RotateCcw className="h-4 w-4" />
            {t("tryAgain")}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 gap-2">
          <Link href={`/learn/${languageSlug}/courses/${courseId}`}>
            <ArrowLeft className="h-4 w-4" />
            {t("backToCourse")}
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  label, value, color, icon,
}: {
  label: string
  value: string
  color: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-1">
      <div className={cn("text-2xl font-bold flex items-center justify-center gap-1", color)}>
        {icon}{value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
