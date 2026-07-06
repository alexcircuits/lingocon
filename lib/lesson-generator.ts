import type {
  Exercise,
  MultipleChoiceExercise,
  TranslateExercise,
  ClozeExercise,
  MatchPairsExercise,
  SentenceBuilderExercise,
  InfoExercise,
  WordIntroExercise,
} from "@/types/lesson"
import { blankWholeWord } from "@/lib/cloze"

// Target one production drill per vocab item, with a floor so tiny lessons
// still feel substantive. Production = typed TRANSLATE / reverse MC /
// SENTENCE_BUILDER (the parts that go beyond intro + first recognition).
const PRODUCTION_PER_WORD = 1
const PRODUCTION_FLOOR = 4

export interface VocabItem {
  id: string
  lemma: string       // conlang word
  gloss: string       // native meaning
  ipa?: string | null
  partOfSpeech?: string | null
  exampleSentences?: {
    id: string
    sentence: string
    translation: string
    gloss: string | null
  }[]
}

export interface SentenceItem {
  id: string
  sentence: string      // conlang sentence
  translation: string   // native translation
}

export interface ConceptItem {
  id: string
  kind: "GRAMMAR" | "TEXT"
  title: string
  body: string          // plain-text excerpt
  href?: string         // link to full page
}

export interface LessonContent {
  vocab: VocabItem[]
  sentences: SentenceItem[]
  concepts: ConceptItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickDistractors(correct: VocabItem, pool: VocabItem[], count: number, field: "lemma" | "gloss"): string[] {
  const others = pool.filter(v => v.id !== correct.id)
  return shuffle(others)
    .slice(0, count)
    .map(v => v[field])
}

// ─── Exercise builders ────────────────────────────────────────────────────────

function buildMultipleChoice(
  item: VocabItem,
  pool: VocabItem[],
  direction: "to_native" | "to_target",
): MultipleChoiceExercise {
  const isToNative = direction === "to_native"
  const word = isToNative ? item.lemma : item.gloss
  const correctText = isToNative ? item.gloss : item.lemma
  const distractorField: "lemma" | "gloss" = isToNative ? "gloss" : "lemma"

  const distractors = pickDistractors(item, pool, 3, distractorField)
  const options = shuffle([
    { id: `${item.id}-c`, text: correctText, correct: true },
    ...distractors.map((t, i) => ({ id: `${item.id}-w${i}`, text: t, correct: false })),
  ])

  return {
    type: "MULTIPLE_CHOICE",
    id: `mc-${direction}-${item.id}`,
    entryId: item.id,
    direction,
    prompt: isToNative ? "What does this mean?" : "How do you say this?",
    word,
    options,
  }
}

function buildTranslate(
  item: VocabItem,
  direction: "to_native" | "to_target",
): TranslateExercise {
  const isToNative = direction === "to_native"
  return {
    type: "TRANSLATE",
    id: `tr-${direction}-${item.id}`,
    entryId: item.id,
    direction,
    prompt: isToNative ? "Translate this word" : "How do you write this?",
    word: isToNative ? item.lemma : item.gloss,
    answer: isToNative ? item.gloss : item.lemma,
    hint: item.ipa ? `/${item.ipa}/` : item.partOfSpeech ?? undefined,
  }
}

function buildMatchPairs(chunk: VocabItem[]): MatchPairsExercise {
  return {
    type: "MATCH_PAIRS",
    id: `match-${chunk.map(v => v.id).join("-")}`,
    // Right column is shuffled independently so columns don't align visually
    pairs: chunk.map(v => ({ id: v.id, left: v.lemma, right: v.gloss })),
  }
}

const SB_DISTRACTOR_CAP = 2

function buildSentenceBuilder(
  item: VocabItem,
  pool: VocabItem[]
): SentenceBuilderExercise | null {
  if (!item.exampleSentences || item.exampleSentences.length === 0) return null

  const sentenceObj = item.exampleSentences[Math.floor(Math.random() * item.exampleSentences.length)]

  const cleanSentence = sentenceObj.sentence.replace(/[.,!?()";:]/g, "").trim()
  const correctWords = cleanSentence.split(/\s+/).filter(Boolean)
  if (correctWords.length < 2) return null

  // Prefer distractors that share part-of-speech with the seed word — this
  // makes the wrong choices plausible rather than obviously wrong.
  const others = pool.filter(v => v.id !== item.id)
  const samePos = item.partOfSpeech
    ? others.filter(v => v.partOfSpeech === item.partOfSpeech)
    : []
  const candidatePool = samePos.length >= SB_DISTRACTOR_CAP ? samePos : others

  const distractors: string[] = []
  for (const candidate of shuffle(candidatePool).map(v => v.lemma)) {
    if (distractors.length >= SB_DISTRACTOR_CAP) break
    if (!correctWords.includes(candidate) && !distractors.includes(candidate)) {
      distractors.push(candidate)
    }
  }

  const allWords = shuffle([...correctWords, ...distractors])

  return {
    type: "SENTENCE_BUILDER",
    id: `sb-${item.id}-${sentenceObj.id}`,
    prompt: sentenceObj.translation,
    sentence: cleanSentence,
    words: allWords.map((text, idx) => ({ id: `word-${idx}`, text }))
  }
}

type ExampleSentence = NonNullable<VocabItem["exampleSentences"]>[number]

export function buildCloze(item: VocabItem, pool: VocabItem[]): ClozeExercise | null {
  if (!item.exampleSentences || item.exampleSentences.length === 0) return null
  // Pick the first example whose sentence contains the lemma as a whole word.
  // blankWholeWord returns null when the lemma is absent, so this both filters
  // and produces the blanked sentence (all occurrences masked).
  let ex: ExampleSentence | undefined
  let blanked: string | null = null
  for (const candidate of item.exampleSentences) {
    const masked = blankWholeWord(candidate.sentence, item.lemma)
    if (masked !== null) {
      ex = candidate
      blanked = masked
      break
    }
  }
  if (!ex || blanked === null) return null

  const distractors = pickDistractors(item, pool, 3, "lemma")
  const options = shuffle([
    { id: `${item.id}-c`, text: item.lemma, correct: true },
    ...distractors.map((t, i) => ({ id: `${item.id}-w${i}`, text: t, correct: false })),
  ])
  return {
    type: "CLOZE",
    id: `cloze-${item.id}-${ex.id}`,
    entryId: item.id,
    sentence: blanked,
    answer: item.lemma,
    options,
    translation: ex.translation,
  }
}

/** Sentence-builder from an explicit sentence item (not tied to a vocab word). */
function buildSentenceBuilderFromSentence(
  sentence: SentenceItem,
  distractorPool: string[],
): SentenceBuilderExercise | null {
  const cleanSentence = sentence.sentence.replace(/[.,!?()";:]/g, "").trim()
  const correctWords = cleanSentence.split(/\s+/).filter(Boolean)
  if (correctWords.length < 2) return null

  const distractors: string[] = []
  const pool = shuffle(distractorPool.filter(Boolean))
  for (const candidate of pool) {
    if (distractors.length >= SB_DISTRACTOR_CAP) break
    if (!correctWords.includes(candidate) && !distractors.includes(candidate)) {
      distractors.push(candidate)
    }
  }

  const allWords = shuffle([...correctWords, ...distractors])
  return {
    type: "SENTENCE_BUILDER",
    id: `sb-sentence-${sentence.id}`,
    prompt: sentence.translation,
    sentence: cleanSentence,
    words: allWords.map((text, idx) => ({ id: `word-${idx}`, text })),
  }
}

function buildWordIntro(item: VocabItem): WordIntroExercise {
  const first = item.exampleSentences?.[0]
  return {
    type: "WORD_INTRO",
    id: `intro-${item.id}`,
    word: item.lemma,
    gloss: item.gloss,
    ipa: item.ipa ?? undefined,
    partOfSpeech: item.partOfSpeech ?? undefined,
    example: first ? { sentence: first.sentence, translation: first.translation } : undefined,
  }
}

function buildInfoCard(concept: ConceptItem): InfoExercise {
  const trimmed = concept.body.length > 600 ? `${concept.body.slice(0, 600).trim()}…` : concept.body
  return {
    type: "INFO",
    id: `info-${concept.kind.toLowerCase()}-${concept.id}`,
    kind: concept.kind,
    title: concept.title,
    body: trimmed,
    href: concept.href,
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generates a Duolingo-style exercise sequence from a list of vocabulary items.
 *
 * Sequence per lesson:
 *   1. **Intro pass** — for each new word: WORD_INTRO flashcard, then a
 *      recognition MULTIPLE_CHOICE (conlang→native). The learner always sees
 *      the meaning before being quizzed on it.
 *   2. **Match-pairs warm-up** — chunks of up to 6, after every word has been
 *      introduced and recognized at least once. Cold pattern-matching against
 *      unfamiliar script is no longer the first thing the learner sees.
 *   3. **Production round** — typed TRANSLATE, reverse MC (native→conlang),
 *      and SENTENCE_BUILDER where example sentences exist. Shuffled.
 *
 * The graded portion is capped at LESSON_GRADED_CAP exercises so a 20-word list
 * doesn't blow up into a 60-card slog. The cap prioritizes coverage: every word
 * keeps its intro + first recognition; bonus production drills are trimmed first.
 */
export function generateExercises(items: VocabItem[]): Exercise[] {
  if (items.length === 0) return []

  // ── 1. Intro pass: introduce each word, then immediately quiz recognition.
  const introPass: Exercise[] = []
  for (const item of items) {
    introPass.push(buildWordIntro(item))
    introPass.push(buildMultipleChoice(item, items, "to_native"))
  }

  // ── 2. Match-pairs warm-up — only after every word has been introduced.
  const matchPairs: Exercise[] = []
  for (let i = 0; i < items.length; i += 6) {
    const chunk = items.slice(i, i + 6)
    if (chunk.length >= 2) {
      matchPairs.push(buildMatchPairs(shuffle(chunk)))
    }
  }

  // ── 3. Production round.
  const production: Exercise[] = []
  for (const item of items) {
    production.push(buildTranslate(item, "to_target"))
    if (items.length >= 4) {
      production.push(buildMultipleChoice(item, items, "to_target"))
    }
    const sb = buildSentenceBuilder(item, items)
    if (sb) production.push(sb)
    const cloze = buildCloze(item, items)
    if (cloze) production.push(cloze)
  }
  const productionShuffled = shuffle(production)

  // ── Compose with a production budget that scales with vocab count.
  // Intro pass and match-pairs are protected — they're the "learn it" portion.
  const productionBudget = Math.max(PRODUCTION_FLOOR, items.length * PRODUCTION_PER_WORD)
  const productionTrimmed = productionShuffled.slice(0, productionBudget)

  return [...introPass, ...matchPairs, ...productionTrimmed]
}

/**
 * Builds a full lesson session from mixed content (vocab + sentences + grammar/
 * text concepts). Concepts are taught first as non-graded INFO cards, then the
 * graded vocab + sentence exercises follow.
 *
 * A lesson is "playable" whenever this returns at least one exercise — including
 * concept-only (reading) lessons, which previously could not be started at all.
 */
export function generateLessonExercises(content: LessonContent): Exercise[] {
  const { vocab, sentences, concepts } = content

  // 1. Teaching cards (grammar before text), shown up front.
  const grammarFirst = [...concepts].sort((a, b) =>
    a.kind === b.kind ? 0 : a.kind === "GRAMMAR" ? -1 : 1,
  )
  const infoCards = grammarFirst.map(buildInfoCard)

  // 2. Vocab exercises (existing pipeline).
  const vocabExercises = vocab.length > 0 ? generateExercises(vocab) : []

  // 3. Sentence exercises from explicit sentence items.
  const distractorPool = vocab.map((v) => v.lemma)
  const sentenceExercises: Exercise[] = []
  for (const sentence of sentences) {
    const sb = buildSentenceBuilderFromSentence(sentence, distractorPool)
    if (sb) sentenceExercises.push(sb)
  }

  return [...infoCards, ...vocabExercises, ...shuffle(sentenceExercises)]
}

/** Whether a set of lesson item types can produce a playable session. */
export function lessonHasPlayableContent(types: string[]): boolean {
  return types.some((t) => t === "VOCAB" || t === "SENTENCE" || t === "GRAMMAR" || t === "TEXT")
}
