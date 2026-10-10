import { unique } from "../fixtures"
import { db, userId } from "../db"
import { scratchLanguage } from "../access/helpers"

/**
 * A PUBLIC or PRIVATE scratch language (owned by `owner`, entries kala/nemi) with one
 * PUBLISHED course → one unit → one lesson. The lesson holds a grammar card and, when
 * asked, a vocab item, so it plays as a single "Continue" info card plus vocab drills.
 */
export async function scratchCourse(
  options: { visibility?: "PUBLIC" | "PRIVATE"; vocab?: boolean } = {}
): Promise<{
  language: { id: string; slug: string; name: string }
  courseId: string
  courseTitle: string
  lessonId: string
  lessonTitle: string
  grammarTitle: string
  vocabLemma: string | null
}> {
  const language = await scratchLanguage("owner", { visibility: options.visibility ?? "PUBLIC" })
  const suffix = unique()
  const grammarTitle = `Greeting notes ${suffix}`
  const grammar = await db().grammarPage.create({
    data: {
      title: grammarTitle,
      slug: `greetings-${suffix}`,
      order: 0,
      languageId: language.id,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Greet with kala." }] }],
      },
    },
    select: { id: true },
  })
  const courseTitle = `Course ${suffix}`
  const course = await db().course.create({
    data: { title: courseTitle, languageId: language.id, authorId: await userId("owner"), visibility: "PUBLISHED" },
    select: { id: true },
  })
  const unit = await db().unit.create({ data: { title: "Basics", order: 0, courseId: course.id }, select: { id: true } })
  const lessonTitle = `Lesson ${suffix}`
  const lesson = await db().courseLesson.create({
    data: { title: lessonTitle, order: 0, courseId: course.id, unitId: unit.id },
    select: { id: true },
  })
  await db().lessonItem.create({ data: { lessonId: lesson.id, type: "GRAMMAR", order: 0, grammarPageId: grammar.id } })

  let vocabLemma: string | null = null
  if (options.vocab) {
    const entry = await db().dictionaryEntry.findFirstOrThrow({
      where: { languageId: language.id, lemma: "kala" },
      select: { id: true, lemma: true },
    })
    await db().lessonItem.create({ data: { lessonId: lesson.id, type: "VOCAB", order: 1, dictEntryId: entry.id } })
    vocabLemma = entry.lemma
  }

  return { language, courseId: course.id, courseTitle, lessonId: lesson.id, lessonTitle, grammarTitle, vocabLemma }
}
