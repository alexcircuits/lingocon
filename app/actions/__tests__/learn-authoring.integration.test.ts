// @vitest-environment node
//
// Course authoring against a real PostgreSQL. Runs only when DATABASE_URL names a disposable local
// `lingocon_rewrite_test_*` database; every row it writes carries a random prefix and is removed in
// afterAll (languages cascade to courses, entries, activities and collaborators).
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const actor = vi.hoisted(() => ({ id: null as string | null }))
vi.mock("@/auth", () => ({ auth: async () => (actor.id ? { user: { id: actor.id } } : null) }))
vi.mock("@/app/actions/badge", () => ({
  checkLearnerBadges: vi.fn(async () => undefined),
  checkDictionaryBadges: vi.fn(async () => undefined),
}))

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import * as learn from "../learn"

function isDisposableLocalDatabase(raw: string | undefined): boolean {
  if (!raw) return false
  try {
    const url = new URL(raw)
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && /^\/lingocon_rewrite_test_[a-z0-9_]+$/.test(url.pathname)
      && url.search === "" // ?host= etc. could point Prisma elsewhere
  } catch {
    return false
  }
}

const prefix = `learn-${randomUUID().replace(/-/g, "").slice(0, 16)}`
const users = { owner: `${prefix}-owner`, grammarEditor: `${prefix}-grammar`, outsider: `${prefix}-outsider` }
const languageId = `${prefix}-lang`
const otherLanguageId = `${prefix}-other`
const strictLanguageId = `${prefix}-strict`
const slug = languageId
const entries = { a: `${prefix}-entry-a`, b: `${prefix}-entry-b`, c: `${prefix}-entry-c` }

interface Fixture {
  courseId: string
  units: [string, string]
  lessons: [string, string]
  items: [string, string]
}

/** A fresh course per test so destructive actions never affect each other. */
async function seedCourse(lang = languageId, entryIds: [string, string] = [entries.a, entries.b]): Promise<Fixture> {
  const courseId = `${prefix}-course-${randomUUID().slice(0, 8)}`
  const units: [string, string] = [`${courseId}-u1`, `${courseId}-u2`]
  const lessons: [string, string] = [`${courseId}-l1`, `${courseId}-l2`]
  const items: [string, string] = [`${courseId}-i1`, `${courseId}-i2`]
  await prisma.course.create({ data: { id: courseId, title: "Course", languageId: lang, authorId: users.owner } })
  await prisma.unit.createMany({ data: units.map((id, order) => ({ id, courseId, title: `Unit ${order}`, order })) })
  await prisma.courseLesson.createMany({
    data: lessons.map((id, order) => ({ id, courseId, unitId: units[0], title: `Lesson ${order}`, order })),
  })
  await prisma.lessonItem.createMany({
    data: items.map((id, order) => ({ id, lessonId: lessons[0], type: "VOCAB" as const, dictEntryId: entryIds[order], order })),
  })
  return { courseId, units, lessons, items }
}

const coursePaths = (courseId: string) => [
  `/studio/lang/${slug}/courses`,
  `/studio/lang/${slug}/courses/${courseId}`,
  `/learn/${slug}`,
  `/learn/${slug}/courses/${courseId}`,
]
const lessonPath = (lessonId: string) => `/learn/${slug}/lesson/${lessonId}`
const dictionaryPaths = [`/studio/lang/${slug}/dictionary`, `/lang/${slug}/dictionary`]

function revalidatedPaths(): string[] {
  return vi.mocked(revalidatePath).mock.calls.map(([path]) => path)
}

async function itemOrders(ids: readonly string[]): Promise<Record<string, number>> {
  const rows = await prisma.lessonItem.findMany({ where: { id: { in: [...ids] } }, select: { id: true, order: true } })
  return Object.fromEntries(rows.map((r) => [r.id, r.order]))
}

describe.skipIf(!isDisposableLocalDatabase(process.env.DATABASE_URL))("course authoring with PostgreSQL", () => {
  beforeAll(async () => {
    process.env.DEV_MODE = "false"
    await prisma.user.createMany({ data: Object.values(users).map((id) => ({ id, email: `${id}@example.test` })) })
    await prisma.language.createMany({
      data: [
        { id: languageId, slug, name: "Learn fixture", ownerId: users.owner },
        { id: otherLanguageId, slug: otherLanguageId, name: "Other fixture", ownerId: users.owner },
        {
          id: strictLanguageId, slug: strictLanguageId, name: "Strict fixture", ownerId: users.owner,
          metadata: { syllableStructure: "CV", consonants: ["p", "t"], vowels: ["a"] },
        },
      ],
    })
    await prisma.languageCollaborator.create({
      data: { languageId, userId: users.grammarEditor, role: "EDITOR", permissions: ["write:grammar"] },
    })
    await prisma.dictionaryEntry.createMany({
      data: [
        ...Object.entries(entries).map(([name, id]) => ({ id, languageId, lemma: `lemma-${name}`, gloss: name })),
        { id: `${prefix}-other-entry`, languageId: otherLanguageId, lemma: "other", gloss: "other" },
        { id: `${prefix}-other-entry-2`, languageId: otherLanguageId, lemma: "other2", gloss: "other2" },
      ],
    })
  })
  beforeEach(() => {
    actor.id = users.owner
    vi.mocked(revalidatePath).mockClear()
  })
  afterAll(async () => {
    await prisma.language.deleteMany({ where: { id: { in: [languageId, otherLanguageId, strictLanguageId] } } })
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } })
    await prisma.$disconnect()
  })

  describe("every authoring mutation invalidates the routes that render the course", () => {
    type Case = [string, (f: Fixture) => Promise<unknown>, (f: Fixture) => string[]]
    const cases: Case[] = [
      ["updateCourse", (f) => learn.updateCourse(f.courseId, { title: "Renamed" }), (f) => coursePaths(f.courseId)],
      ["createLesson", (f) => learn.createLesson(f.courseId, "New lesson"), (f) => coursePaths(f.courseId)],
      ["createLessonInUnit", (f) => learn.createLessonInUnit(f.units[1], "Unit lesson"), (f) => coursePaths(f.courseId)],
      ["updateLesson", (f) => learn.updateLesson(f.lessons[0], { title: "Edited" }),
        (f) => [...coursePaths(f.courseId), lessonPath(f.lessons[0])]],
      ["reorderLessonItems", (f) => learn.reorderLessonItems(f.lessons[0], [f.items[1], f.items[0]]),
        (f) => [...coursePaths(f.courseId), lessonPath(f.lessons[0])]],
      ["reorderLessons", (f) => learn.reorderLessons(f.courseId, [f.lessons[1], f.lessons[0]]), (f) => coursePaths(f.courseId)],
      ["reorderUnits", (f) => learn.reorderUnits(f.courseId, [f.units[1], f.units[0]]), (f) => coursePaths(f.courseId)],
      ["createUnit", (f) => learn.createUnit(f.courseId, "Unit 3"), (f) => coursePaths(f.courseId)],
      ["updateUnit", (f) => learn.updateUnit(f.units[0], { title: "Renamed unit" }), (f) => coursePaths(f.courseId)],
      ["deleteUnit", (f) => learn.deleteUnit(f.units[1]), (f) => coursePaths(f.courseId)],
      ["setLessonUnit", (f) => learn.setLessonUnit(f.lessons[0], f.units[1]),
        (f) => [...coursePaths(f.courseId), lessonPath(f.lessons[0])]],
      ["addLessonItem", (f) => learn.addLessonItem(f.lessons[1], "VOCAB", entries.c),
        (f) => [...coursePaths(f.courseId), lessonPath(f.lessons[1])]],
      ["deleteLessonItem", (f) => learn.deleteLessonItem(f.items[0]),
        (f) => [...coursePaths(f.courseId), lessonPath(f.lessons[0])]],
      ["deleteLesson", (f) => learn.deleteLesson(f.lessons[1]),
        (f) => [...coursePaths(f.courseId), lessonPath(f.lessons[1])]],
      ["deleteCourse", (f) => learn.deleteCourse(f.courseId), (f) => coursePaths(f.courseId)],
      ["createAndAddSentence", (f) => learn.createAndAddSentence(f.lessons[0], entries.a, "sentence", "translation"),
        (f) => [...coursePaths(f.courseId), lessonPath(f.lessons[0]), ...dictionaryPaths]],
      ["createAndAddVocab", (f) => learn.createAndAddVocab(f.lessons[0], languageId, `${prefix}-word`, "word"),
        (f) => [...coursePaths(f.courseId), lessonPath(f.lessons[0]), ...dictionaryPaths]],
    ]

    it.each(cases)("%s", async (_name, run, expected) => {
      const fixture = await seedCourse()
      const result = await run(fixture)
      expect(result).not.toHaveProperty("error")
      expect(revalidatedPaths()).toEqual(expect.arrayContaining(expected(fixture)))
    })

    it("createCourse", async () => {
      const result = await learn.createCourse(languageId, "Fresh course")
      expect(result).toHaveProperty("data.id")
      const courseId = (result as { data: { id: string } }).data.id
      expect(revalidatedPaths()).toEqual(expect.arrayContaining([
        `/studio/lang/${slug}/courses`, `/studio/lang/${slug}/courses/${courseId}`,
      ]))
    })
  })

  describe("reorder ownership", () => {
    it("rejects item ids from another lesson of the same course and writes nothing", async () => {
      const f = await seedCourse()
      const foreignItem = `${f.courseId}-foreign`
      await prisma.lessonItem.create({ data: { id: foreignItem, lessonId: f.lessons[1], type: "VOCAB", dictEntryId: entries.c, order: 7 } })
      const result = await learn.reorderLessonItems(f.lessons[0], [foreignItem, f.items[1], f.items[0]])
      expect(result).toHaveProperty("error")
      expect(await itemOrders([foreignItem, ...f.items])).toEqual({ [foreignItem]: 7, [f.items[0]]: 0, [f.items[1]]: 1 })
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it("rejects item ids from another language's lesson and writes nothing", async () => {
      const mine = await seedCourse()
      const foreign = await seedCourse(otherLanguageId, [`${prefix}-other-entry`, `${prefix}-other-entry-2`])
      const result = await learn.reorderLessonItems(mine.lessons[0], [foreign.items[1], mine.items[1], mine.items[0]])
      expect(result).toHaveProperty("error")
      expect(await itemOrders([...foreign.items, ...mine.items])).toEqual({
        [foreign.items[0]]: 0, [foreign.items[1]]: 1, [mine.items[0]]: 0, [mine.items[1]]: 1,
      })
    })

    it("rejects duplicated ids", async () => {
      const f = await seedCourse()
      expect(await learn.reorderLessonItems(f.lessons[0], [f.items[1], f.items[1]])).toHaveProperty("error")
      expect(await learn.reorderLessons(f.courseId, [f.lessons[0], f.lessons[0]])).toHaveProperty("error")
      expect(await learn.reorderUnits(f.courseId, [f.units[1], f.units[1]])).toHaveProperty("error")
      expect(await itemOrders(f.items)).toEqual({ [f.items[0]]: 0, [f.items[1]]: 1 })
    })

    it("rejects lessons and units of another course", async () => {
      const mine = await seedCourse()
      const foreign = await seedCourse()
      expect(await learn.reorderLessons(mine.courseId, [foreign.lessons[1], mine.lessons[0]])).toHaveProperty("error")
      expect(await learn.reorderUnits(mine.courseId, [foreign.units[1], mine.units[0]])).toHaveProperty("error")
      const foreignLesson = await prisma.courseLesson.findUniqueOrThrow({ where: { id: foreign.lessons[1] } })
      const foreignUnit = await prisma.unit.findUniqueOrThrow({ where: { id: foreign.units[1] } })
      expect([foreignLesson.order, foreignUnit.order]).toEqual([1, 1])
    })

    it("rejects a caller without edit access", async () => {
      const f = await seedCourse()
      actor.id = users.outsider
      expect(await learn.reorderLessonItems(f.lessons[0], [f.items[1], f.items[0]])).toHaveProperty("error")
      expect(await itemOrders(f.items)).toEqual({ [f.items[0]]: 0, [f.items[1]]: 1 })
    })
  })

  describe("update actions copy only editable fields (mass assignment)", () => {
    it("ignores courseId/languageId/authorId smuggled into update payloads", async () => {
      const mine = await seedCourse()
      const foreign = await seedCourse(otherLanguageId, [`${prefix}-other-entry`, `${prefix}-other-entry-2`])
      const smuggled = { courseId: foreign.courseId, languageId: otherLanguageId, authorId: users.outsider, unitId: foreign.units[0] }

      await learn.updateCourse(mine.courseId, { title: "T1", ...smuggled } as Parameters<typeof learn.updateCourse>[1])
      await learn.updateLesson(mine.lessons[0], { title: "T2", ...smuggled } as Parameters<typeof learn.updateLesson>[1])
      await learn.updateUnit(mine.units[0], { title: "T3", ...smuggled } as Parameters<typeof learn.updateUnit>[1])

      const course = await prisma.course.findUniqueOrThrow({ where: { id: mine.courseId } })
      const lesson = await prisma.courseLesson.findUniqueOrThrow({ where: { id: mine.lessons[0] } })
      const unit = await prisma.unit.findUniqueOrThrow({ where: { id: mine.units[0] } })
      expect([course.title, course.languageId, course.authorId]).toEqual(["T1", languageId, users.owner])
      expect([lesson.title, lesson.courseId, lesson.unitId]).toEqual(["T2", mine.courseId, mine.units[0]])
      expect([unit.title, unit.courseId]).toEqual(["T3", mine.courseId])
    })
  })

  describe("createAndAddVocab writes through the dictionary write path", () => {
    it("creates the entry and the lesson item together, logs activity and invalidates dictionary views", async () => {
      const f = await seedCourse()
      const lemma = `${prefix}-together`
      const result = await learn.createAndAddVocab(f.lessons[0], languageId, lemma, "together", "noun")
      expect(result).toMatchObject({
        data: { item: { lessonId: f.lessons[0], type: "VOCAB", order: 2 }, dictEntry: { lemma, gloss: "together", partOfSpeech: "noun" } },
      })
      const { data } = result as { data: { item: { dictEntryId: string }; dictEntry: { id: string } } }
      expect(data.item.dictEntryId).toBe(data.dictEntry.id)
      expect(await prisma.activity.count({ where: { entityId: data.dictEntry.id, entityType: "DICTIONARY_ENTRY", type: "CREATED" } })).toBe(1)
      expect(revalidatePath).toHaveBeenCalledWith(`/studio/lang/${slug}/dictionary`)
      expect(revalidatePath).toHaveBeenCalledWith(`/studio/lang/${slug}`, "layout")
    })

    it("requires dictionary write permission, not merely course edit access", async () => {
      const f = await seedCourse()
      actor.id = users.grammarEditor
      const lemma = `${prefix}-forbidden`
      const result = await learn.createAndAddVocab(f.lessons[0], languageId, lemma, "forbidden")
      expect(result).toHaveProperty("error")
      expect(await prisma.dictionaryEntry.count({ where: { lemma } })).toBe(0)
      expect(await prisma.lessonItem.count({ where: { lessonId: f.lessons[0] } })).toBe(2)
    })

    it("enforces the language's phonotactic policy like the dictionary does", async () => {
      await prisma.dictionaryEntry.createMany({
        data: [`${prefix}-s1`, `${prefix}-s2`].map((id) => ({ id, languageId: strictLanguageId, lemma: "pa", gloss: "x" })),
      })
      const f = await seedCourse(strictLanguageId, [`${prefix}-s1`, `${prefix}-s2`])
      const rejected = await learn.createAndAddVocab(f.lessons[0], strictLanguageId, "xyzzy", "bad")
      expect(rejected).toHaveProperty("error")
      expect((rejected as { error: string }).error).toMatch(/syllable structure/)
      expect(await prisma.dictionaryEntry.count({ where: { languageId: strictLanguageId, lemma: "xyzzy" } })).toBe(0)
      expect(await prisma.lessonItem.count({ where: { lessonId: f.lessons[0] } })).toBe(2)

      const accepted = await learn.createAndAddVocab(f.lessons[0], strictLanguageId, "pata", "good")
      expect(accepted).not.toHaveProperty("error")
    })

    it("rejects a lesson from another language without creating a word", async () => {
      const f = await seedCourse()
      const lemma = `${prefix}-mismatch`
      expect(await learn.createAndAddVocab(f.lessons[0], otherLanguageId, lemma, "mismatch")).toHaveProperty("error")
      expect(await prisma.dictionaryEntry.count({ where: { lemma } })).toBe(0)
    })
  })

  describe("createAndAddSentence writes dictionary content", () => {
    it("requires dictionary write permission", async () => {
      const f = await seedCourse()
      actor.id = users.grammarEditor
      const result = await learn.createAndAddSentence(f.lessons[0], entries.a, `${prefix}-sentence`, "translation")
      expect(result).toHaveProperty("error")
      expect(await prisma.exampleSentence.count({ where: { sentence: `${prefix}-sentence` } })).toBe(0)
      expect(await prisma.lessonItem.count({ where: { lessonId: f.lessons[0] } })).toBe(2)
    })

    it("validates the sentence like the example-sentence editor", async () => {
      const f = await seedCourse()
      expect(await learn.createAndAddSentence(f.lessons[0], entries.a, "x".repeat(501), "translation")).toHaveProperty("error")
      expect(await learn.createAndAddSentence(f.lessons[0], entries.a, "  ", "translation")).toHaveProperty("error")
      expect(await prisma.lessonItem.count({ where: { lessonId: f.lessons[0] } })).toBe(2)
    })
  })
})
