import { afterEach, describe, expect, it, vi } from "vitest"
import {
  generateExercises,
  generateLessonExercises,
  buildCloze,
  type VocabItem,
} from "../lesson-generator"

const vocab = (n: number): VocabItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `v${i}`,
    lemma: `word${i}`,
    gloss: `meaning${i}`,
    ipa: null,
    partOfSpeech: i % 2 === 0 ? "noun" : "verb",
  }))

const vocabWithSentence = (n: number): VocabItem[] =>
  vocab(n).map(v => ({
    ...v,
    exampleSentences: [
      { id: `${v.id}-ex1`, sentence: `I like the ${v.lemma} today.`, translation: `Native for ${v.lemma}`, gloss: null },
    ],
  }))

describe("generateExercises — new Duolingo-style ordering", () => {
  it("returns an empty list when there are no vocab items", () => {
    expect(generateExercises([])).toEqual([])
  })

  it("emits a WORD_INTRO before the first recognition MC for each word", () => {
    const items = vocab(5)
    const exercises = generateExercises(items)

    for (const item of items) {
      const introIdx = exercises.findIndex(
        e => e.type === "WORD_INTRO" && e.id === `intro-${item.id}`,
      )
      const firstRecognitionIdx = exercises.findIndex(
        e =>
          e.type === "MULTIPLE_CHOICE" &&
          e.direction === "to_native" &&
          e.id === `mc-to_native-${item.id}`,
      )
      expect(introIdx).toBeGreaterThanOrEqual(0)
      expect(firstRecognitionIdx).toBeGreaterThan(introIdx)
    }
  })

  it("places MATCH_PAIRS after every word has been introduced and recognized", () => {
    const items = vocab(6)
    const exercises = generateExercises(items)

    const firstMatchIdx = exercises.findIndex(e => e.type === "MATCH_PAIRS")
    expect(firstMatchIdx).toBeGreaterThanOrEqual(0)

    // Every intro and every to_native MC must precede the first match-pairs.
    const introCountBefore = exercises
      .slice(0, firstMatchIdx)
      .filter(e => e.type === "WORD_INTRO").length
    const recognitionCountBefore = exercises
      .slice(0, firstMatchIdx)
      .filter(e => e.type === "MULTIPLE_CHOICE" && e.direction === "to_native").length

    expect(introCountBefore).toBe(items.length)
    expect(recognitionCountBefore).toBe(items.length)
  })

  it("does not lead with MATCH_PAIRS (no cold word-wall)", () => {
    const exercises = generateExercises(vocab(4))
    expect(exercises[0]?.type).toBe("WORD_INTRO")
  })

  it("caps production-round size to scale with vocab count", () => {
    // 6-word lesson: production budget = max(4, 6) = 6 cards
    const exercises = generateExercises(vocab(6))
    const production = exercises.filter(
      e =>
        e.type === "TRANSLATE" ||
        (e.type === "MULTIPLE_CHOICE" && e.direction === "to_target") ||
        e.type === "SENTENCE_BUILDER",
    )
    expect(production.length).toBeLessThanOrEqual(6)
  })

  it("guarantees a minimum production floor on tiny lessons", () => {
    // 1-word lesson: production budget = max(4, 1) = 4 — though we can't
    // exceed what the production round actually generates for 1 item.
    const exercises = generateExercises(vocab(1))
    const production = exercises.filter(
      e =>
        e.type === "TRANSLATE" ||
        (e.type === "MULTIPLE_CHOICE" && e.direction === "to_target") ||
        e.type === "SENTENCE_BUILDER",
    )
    // For 1 item: only TRANSLATE is generated (reverse MC needs ≥4 in pool,
    // sentence builder needs example sentences). So we expect exactly 1.
    expect(production.length).toBe(1)
  })
})

describe("generateExercises — entryId threading", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("sets entryId on MULTIPLE_CHOICE exercises to the source vocab item id", () => {
    // to_native MC comes from the intro pass, which is never trimmed, so this
    // is deterministic regardless of the production-round shuffle.
    const items = vocab(5)
    const exercises = generateExercises(items)
    const mcExercises = exercises.filter(e => e.type === "MULTIPLE_CHOICE")
    expect(mcExercises.length).toBeGreaterThan(0)
    for (const ex of mcExercises) {
      expect(ex.entryId).toBeDefined()
      expect(items.some(i => i.id === ex.entryId)).toBe(true)
    }
  })

  it("sets entryId on TRANSLATE exercises to the source vocab item id", () => {
    // TRANSLATE only appears in the trimmed production round; pin Math.random so
    // the shuffle/trim is deterministic and at least one TRANSLATE survives.
    vi.spyOn(Math, "random").mockReturnValue(0)
    const items = vocab(5)
    const exercises = generateExercises(items)
    const trExercises = exercises.filter(e => e.type === "TRANSLATE")
    expect(trExercises.length).toBeGreaterThan(0)
    for (const ex of trExercises) {
      expect(ex.entryId).toBeDefined()
      expect(items.some(i => i.id === ex.entryId)).toBe(true)
    }
  })
})

describe("buildCloze — deterministic unit tests", () => {
  const item = (): VocabItem => vocabWithSentence(1)[0]
  const pool = (): VocabItem[] => vocabWithSentence(4)

  it("blanks the lemma out of the sentence and keeps the answer as the lemma", () => {
    const it0 = item()
    const cloze = buildCloze(it0, pool())
    expect(cloze).not.toBeNull()
    expect(cloze!.sentence).toContain("____")
    expect(cloze!.answer).toBe(it0.lemma)
    // The lemma must not remain as a standalone word in the blanked sentence.
    const re = new RegExp(`(^|\\s)${it0.lemma}(?=\\s|$|[.,!?;:])`, "i")
    expect(re.test(cloze!.sentence)).toBe(false)
  })

  it("produces exactly one correct option whose text equals the lemma (any shuffle)", () => {
    const it0 = item()
    const cloze = buildCloze(it0, pool())
    expect(cloze).not.toBeNull()
    const correctOptions = cloze!.options.filter(o => o.correct)
    expect(correctOptions.length).toBe(1)
    expect(correctOptions[0].text).toBe(it0.lemma)
  })

  it("sets entryId equal to the source vocab item id", () => {
    const it0 = item()
    const cloze = buildCloze(it0, pool())
    expect(cloze).not.toBeNull()
    expect(cloze!.entryId).toBe(it0.id)
  })

  it("returns null when the item has no example sentences", () => {
    const it0 = vocab(1)[0] // no exampleSentences at all
    expect(buildCloze(it0, pool())).toBeNull()
  })

  it("returns null when no example sentence contains the lemma", () => {
    const it0: VocabItem = {
      ...vocab(1)[0],
      exampleSentences: [
        { id: "v0-ex1", sentence: "This sentence does not mention the target at all.", translation: "translation", gloss: null },
      ],
    }
    expect(buildCloze(it0, pool())).toBeNull()
  })
})

describe("generateLessonExercises — concepts and sentences", () => {
  it("places INFO concept cards before vocab exercises", () => {
    const exercises = generateLessonExercises({
      vocab: vocab(2),
      sentences: [],
      concepts: [
        { id: "g1", kind: "GRAMMAR", title: "Plurals", body: "..." },
      ],
    })

    const infoIdx = exercises.findIndex(e => e.type === "INFO")
    const introIdx = exercises.findIndex(e => e.type === "WORD_INTRO")
    expect(infoIdx).toBeGreaterThanOrEqual(0)
    expect(introIdx).toBeGreaterThan(infoIdx)
  })

  it("orders GRAMMAR concepts before TEXT concepts", () => {
    const exercises = generateLessonExercises({
      vocab: [],
      sentences: [],
      concepts: [
        { id: "t1", kind: "TEXT", title: "Reading 1", body: "..." },
        { id: "g1", kind: "GRAMMAR", title: "Tenses", body: "..." },
      ],
    })

    const infoCards = exercises.filter(e => e.type === "INFO")
    expect(infoCards.map(c => (c.type === "INFO" ? c.kind : null))).toEqual([
      "GRAMMAR",
      "TEXT",
    ])
  })

  it("renders a sentence-only lesson with no vocab", () => {
    const exercises = generateLessonExercises({
      vocab: [],
      sentences: [
        { id: "s1", sentence: "ana qora bia", translation: "I eat fish" },
      ],
      concepts: [],
    })
    expect(exercises.some(e => e.type === "SENTENCE_BUILDER")).toBe(true)
  })
})
