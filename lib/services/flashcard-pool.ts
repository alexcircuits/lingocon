import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export interface FlashcardEntry {
  id: string
  lemma: string
  gloss: string
  ipa: string | null
  partOfSpeech: string | null
}

/**
 * Upper bound on entries sent to a flashcard/quiz session. Sessions draw at most
 * a few dozen cards; the page previously serialized the entire dictionary into
 * the client payload (about 12 MB for a 100k-word project).
 */
export const FLASHCARD_POOL_LIMIT = 2000
/** Every part of speech keeps enough entries for a quiz (four options) and a deck. */
const MIN_PER_PART_OF_SPEECH = 25

const FIELDS = { id: true, lemma: true, gloss: true, ipa: true, partOfSpeech: true } as const

/**
 * Entries for a practice session: the whole dictionary when it fits the limit,
 * otherwise a uniform random sample drawn separately for each part of speech so
 * the part-of-speech filter still offers every category.
 */
export async function getFlashcardPool(languageId: string): Promise<FlashcardEntry[]> {
  const groups = await prisma.dictionaryEntry.groupBy({
    by: ["partOfSpeech"],
    where: { languageId },
    _count: { _all: true },
  })
  const total = groups.reduce((sum, group) => sum + group._count._all, 0)
  if (total === 0) return []

  if (total <= FLASHCARD_POOL_LIMIT) {
    return prisma.dictionaryEntry.findMany({
      where: { languageId },
      select: FIELDS,
      orderBy: { id: "asc" },
    })
  }

  const perPartOfSpeech = Math.max(MIN_PER_PART_OF_SPEECH, Math.floor(FLASHCARD_POOL_LIMIT / groups.length))
  return prisma.$queryRaw<FlashcardEntry[]>(Prisma.sql`
    SELECT id, lemma, gloss, ipa, "partOfSpeech"
    FROM (
      SELECT id, lemma, gloss, ipa, "partOfSpeech",
             row_number() OVER (PARTITION BY "partOfSpeech" ORDER BY random()) AS rn
      FROM dictionary_entries
      WHERE "languageId" = ${languageId}
    ) sampled
    WHERE rn <= ${perPartOfSpeech}`)
}
