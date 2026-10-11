import { test, expect, expectNoPageErrors, signedInAs, unique } from "../fixtures"
import { authFile } from "../data"
import { db, userId } from "../db"
import { cleanupScratchLanguages, collectPageErrors, ownerScratch, toast } from "./helpers"

/**
 * Courses: the owner builds a course in the studio (unit → lesson → items), publishes it, and a
 * learner (`stranger`) then finds it under /learn/<slug>. Courses are addressed by id:
 * studio /studio/lang/<slug>/courses/<courseId>, learner /learn/<slug>/courses/<courseId>.
 */
signedInAs("owner")
test.afterAll(cleanupScratchLanguages)

test.describe("studio courses", () => {
  test("build a course with a unit, a lesson and items, publish it, and a learner sees it", async ({
    page,
    pageErrors,
    browser,
    baseURL,
  }) => {
    const lang = await ownerScratch("PUBLIC", [
      { lemma: "kala", gloss: "stone" },
      { lemma: "nemi", gloss: "name" },
    ])
    const id = unique()
    const courseTitle = `Starter course ${id}`
    const unitTitle = `Basics ${id}`
    const lessonTitle = `Greetings ${id}`

    const learner = await browser.newContext({ baseURL, storageState: authFile("stranger") })
    const learnerPage = await learner.newPage()
    const learnerErrors = collectPageErrors(learnerPage)
    try {
      await test.step("a learner sees no course before anything is published", async () => {
        await learnerPage.goto(`/learn/${lang.slug}`)
        await expect(learnerPage.getByText("No courses published yet.")).toBeVisible()
      })

      await test.step("create the course", async () => {
        await page.goto(`/studio/lang/${lang.slug}/courses`)
        await expect(page.getByText("No courses yet")).toBeVisible()
        await page.getByRole("button", { name: "New Course" }).first().click()
        const dialog = page.getByRole("dialog", { name: "Create a Course" })
        await dialog.getByLabel("Title").fill(courseTitle)
        await dialog.getByLabel(/Description/).fill("Say hello and name things.")
        await dialog.getByRole("button", { name: "Create" }).click()

        await page.waitForURL(new RegExp(`/studio/lang/${lang.slug}/courses/[^/]+$`))
        await expect(toast(page, "Course created")).toBeVisible()
        await expect(page.getByRole("heading", { level: 1, name: courseTitle })).toBeVisible()
        await expect(page.getByText("draft", { exact: true })).toBeVisible()
      })
      const courseId = page.url().split("/").pop()!
      const stored = await db().course.findUniqueOrThrow({ where: { id: courseId } })
      expect(stored).toMatchObject({ title: courseTitle, languageId: lang.id, visibility: "DRAFT" })

      await test.step("add a unit and a lesson in it", async () => {
        await page.getByRole("button", { name: "Add Unit" }).click()
        const unitDialog = page.getByRole("dialog", { name: "Add Unit" })
        await unitDialog.getByPlaceholder("e.g. Basics").fill(unitTitle)
        await unitDialog.getByRole("button", { name: "Add", exact: true }).click()
        await expect(toast(page, "Unit added")).toBeVisible()
        await expect(page.getByRole("heading", { level: 3, name: unitTitle })).toBeVisible()
        await expect(page.getByText("Unit 1", { exact: true })).toBeVisible()

        await page.getByRole("button", { name: "Add Lesson to Unit" }).click()
        const lessonDialog = page.getByRole("dialog", { name: "Add Lesson" })
        await lessonDialog.getByPlaceholder("e.g. Greetings").fill(lessonTitle)
        await lessonDialog.getByRole("button", { name: "Add", exact: true }).click()
        await expect(toast(page, "Lesson added")).toBeVisible()
        await expect(page.getByRole("button", { name: new RegExp(lessonTitle) })).toBeVisible()
      })

      await test.step("add an existing word and a new word to the lesson", async () => {
        await page.getByRole("button", { name: new RegExp(lessonTitle) }).click()
        await expect(page.getByText("No items yet — add content below.")).toBeVisible()

        await page.getByRole("button", { name: "Add Item" }).click()
        const itemDialog = page.getByRole("dialog", { name: "Add Item to Lesson" })
        // Vocabulary search lists the language's dictionary.
        await itemDialog.getByRole("button", { name: /kala/ }).click()
        await itemDialog.getByRole("button", { name: "Add", exact: true }).click()
        await expect(toast(page, "Item added")).toBeVisible()
        await expect(page.getByText("kala").first()).toBeVisible()

        await page.getByRole("button", { name: "Add Item" }).click()
        await itemDialog.getByRole("button", { name: "Write new" }).click()
        await itemDialog.getByPlaceholder("e.g. kara").fill(`tovi${id}`)
        await itemDialog.getByPlaceholder("e.g. cat").fill("bread")
        await itemDialog.getByRole("button", { name: "Create & Add" }).click()
        await expect(toast(page, "Word created and added")).toBeVisible()
        await expect(page.getByText(`tovi${id}`)).toBeVisible()
        await expect(page.getByRole("button", { name: new RegExp(lessonTitle) })).toContainText("2 items")

        // "Write new" also adds the word to the dictionary.
        expect(await db().dictionaryEntry.count({ where: { languageId: lang.id, lemma: `tovi${id}`, gloss: "bread" } })).toBe(1)
      })

      await test.step("the structure survives a reload", async () => {
        await page.reload()
        await expect(page.getByRole("heading", { level: 3, name: unitTitle })).toBeVisible()
        await page.getByRole("button", { name: new RegExp(lessonTitle) }).click()
        await expect(page.getByText("kala").first()).toBeVisible()
        await expect(page.getByText(`tovi${id}`)).toBeVisible()
      })

      await test.step("publish", async () => {
        await page.getByRole("button", { name: "Publish" }).click()
        await expect(toast(page, "Course published")).toBeVisible()
        await expect(page.getByText("published", { exact: true })).toBeVisible()
        await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible()
        expect((await db().course.findUniqueOrThrow({ where: { id: courseId } })).visibility).toBe("PUBLISHED")

        await page.goto(`/studio/lang/${lang.slug}/courses`)
        await expect(page.getByText(courseTitle)).toBeVisible()
        await expect(page.getByText("1 lesson", { exact: true })).toBeVisible()
      })

      await test.step("the learner finds and opens the course", async () => {
        await learnerPage.goto(`/learn/${lang.slug}`)
        await expect(learnerPage.getByText(courseTitle)).toBeVisible()
        await expect(learnerPage.getByText("Say hello and name things.")).toBeVisible()
        await learnerPage.getByRole("link", { name: "View", exact: true }).click()
        await learnerPage.waitForURL(`**/learn/${lang.slug}/courses/${courseId}`)
        await expect(learnerPage.getByRole("heading", { level: 1, name: courseTitle })).toBeVisible()
        await expect(learnerPage.getByRole("heading", { level: 3, name: unitTitle })).toBeVisible()
        await expect(learnerPage.getByText(lessonTitle)).toBeVisible()
        // The first lesson is open, so its vocabulary is listed.
        await expect(learnerPage.getByText("kala — stone")).toBeVisible()
        await expect(learnerPage.getByText(`tovi${id} — bread`)).toBeVisible()
      })
    } finally {
      await learner.close()
    }
    expectNoPageErrors(learnerErrors)
    expectNoPageErrors(pageErrors)
  })

  test("an unpublished course disappears for learners", async ({ page, pageErrors, browser, baseURL }) => {
    const lang = await ownerScratch("PUBLIC")
    const id = unique()
    const course = await db().course.create({
      data: {
        title: `Withdrawn course ${id}`,
        languageId: lang.id,
        authorId: await userId("owner"),
        visibility: "PUBLISHED",
      },
    })

    await page.goto(`/studio/lang/${lang.slug}/courses/${course.id}`)
    await page.getByRole("button", { name: "Unpublish" }).click()
    await expect(toast(page, "Moved to draft")).toBeVisible()
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible()

    const learner = await browser.newContext({ baseURL, storageState: authFile("stranger") })
    try {
      const learnerPage = await learner.newPage()
      const learnerErrors = collectPageErrors(learnerPage)
      await learnerPage.goto(`/learn/${lang.slug}`)
      await expect(learnerPage.getByText("No courses published yet.")).toBeVisible()
      await expect(learnerPage.getByText(`Withdrawn course ${id}`)).toHaveCount(0)
      expectNoPageErrors(learnerErrors)
    } finally {
      await learner.close()
    }
    expectNoPageErrors(pageErrors)
  })
})
