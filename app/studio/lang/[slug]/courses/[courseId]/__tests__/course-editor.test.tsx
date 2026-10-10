import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const mocks = vi.hoisted(() => ({
  updateCourse: vi.fn(), deleteLesson: vi.fn(), setLessonUnit: vi.fn(),
  reorderLessons: vi.fn(), reorderUnits: vi.fn(), reorderLessonItems: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock("@/app/actions/learn", () => ({
  ...mocks,
  updateLesson: vi.fn(), deleteLessonItem: vi.fn(), updateUnit: vi.fn(), deleteUnit: vi.fn(),
  createLesson: vi.fn(), createLessonInUnit: vi.fn(), createUnit: vi.fn(),
  addLessonItem: vi.fn(), createAndAddSentence: vi.fn(), createAndAddVocab: vi.fn(),
  searchDictEntries: vi.fn(async () => []), searchCourseSentences: vi.fn(async () => []),
}))
vi.mock("sonner", () => ({ toast: mocks.toast }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
// Radix Select needs layout APIs jsdom lacks; a native select exercises the same callback.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select aria-label="Lesson unit" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}))

import { CourseEditor } from "../course-editor"
import type { Course, LessonItem } from "../types"

const item = (id: string, lemma: string, order: number): LessonItem => ({
  id, type: "VOCAB", order, dictEntry: { id: `entry-${id}`, lemma, gloss: `${lemma} gloss`, partOfSpeech: null },
  grammarPage: null, text: null, sentence: null,
})

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: "course", title: "Course", description: null, visibility: "DRAFT",
    units: [
      { id: "u1", title: "Unit One", description: null, order: 0 },
      { id: "u2", title: "Unit Two", description: null, order: 1 },
    ],
    lessons: [
      { id: "l1", title: "Lesson One", description: null, order: 0, unitId: null, items: [item("a", "alpha", 0), item("b", "beta", 1), item("c", "gamma", 2)] },
      { id: "l2", title: "Lesson Two", description: null, order: 1, unitId: null, items: [] },
    ],
    ...overrides,
  }
}

/** The same course with lesson l1's items in the given order (as the server would render it). */
function withItemOrder(course: Course, ids: string[]): Course {
  return {
    ...course,
    lessons: course.lessons.map((l) => l.id === "l1"
      ? { ...l, items: l.items.map((i) => ({ ...i, order: ids.indexOf(i.id) })) }
      : l),
  }
}

const shared = { language: { id: "lang", name: "Lang", slug: "lang" }, grammarPages: [], texts: [], slug: "lang" }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const itemOrder = () => screen.getAllByText(/^(alpha|beta|gamma)$/).map((el) => el.textContent)
const lessonOrder = () => screen.getAllByText(/^Lesson (One|Two)$/).map((el) => el.textContent)
const unitOrder = () => screen.getAllByRole("heading", { level: 3 }).map((el) => el.textContent)
const moveItemDown = (index: number) => fireEvent.click(screen.getAllByRole("button", { name: "Move item down" })[index])

function renderEditor(course: Course = makeCourse()) {
  const view = render(<CourseEditor course={course} {...shared} />)
  fireEvent.click(screen.getByText("Lesson One"))
  return view
}

beforeEach(() => {
  for (const fn of [mocks.reorderLessonItems, mocks.reorderLessons, mocks.reorderUnits, mocks.setLessonUnit]) {
    fn.mockResolvedValue({ data: true })
  }
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("course editor resyncs from server props", () => {
  it("shows the newer server state when a revalidated render delivers new props", () => {
    const view = renderEditor()
    const fresh = makeCourse()
    view.rerender(
      <CourseEditor
        course={{ ...fresh, title: "Renamed course", lessons: fresh.lessons.map((l) => l.id === "l1" ? { ...l, title: "Lesson Renamed" } : l) }}
        {...shared}
      />,
    )
    expect(screen.getByText("Renamed course")).toBeInTheDocument()
    expect(screen.getByText("Lesson Renamed")).toBeInTheDocument()
  })

  it("keeps an in-flight optimistic reorder on top of props that arrive meanwhile", async () => {
    const pending = deferred<{ data: true }>()
    mocks.reorderLessonItems.mockReturnValueOnce(pending.promise)
    const view = renderEditor()
    moveItemDown(0)
    expect(itemOrder()).toEqual(["beta", "alpha", "gamma"])
    view.rerender(<CourseEditor course={{ ...makeCourse(), title: "Fresh title" }} {...shared} />)
    expect(screen.getByText("Fresh title")).toBeInTheDocument()
    expect(itemOrder()).toEqual(["beta", "alpha", "gamma"])
    await act(async () => pending.resolve({ data: true }))
    expect(itemOrder()).toEqual(["beta", "alpha", "gamma"])
  })

  it("rolls a failed reorder back to the newer server order, not the order it started from", async () => {
    const pending = deferred<{ error: string }>()
    mocks.reorderLessonItems.mockReturnValueOnce(pending.promise)
    const view = renderEditor()
    moveItemDown(0)
    // Meanwhile the server's order changed (e.g. another tab moved gamma to the top).
    view.rerender(<CourseEditor course={withItemOrder(makeCourse(), ["c", "a", "b"])} {...shared} />)
    await act(async () => pending.resolve({ error: "conflict" }))
    expect(itemOrder()).toEqual(["gamma", "alpha", "beta"])
  })
})

describe("optimistic course reorders roll back on failure", () => {
  it("restores the item order when the server rejects the reorder", async () => {
    mocks.reorderLessonItems.mockResolvedValueOnce({ error: "Not found" })
    renderEditor()
    moveItemDown(0)
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("failReorderItems"))
    expect(itemOrder()).toEqual(["alpha", "beta", "gamma"])
  })

  it("restores the item order when the action throws", async () => {
    mocks.reorderLessonItems.mockRejectedValueOnce(new Error("Unauthorized"))
    renderEditor()
    moveItemDown(0)
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("failReorderItems"))
    expect(itemOrder()).toEqual(["alpha", "beta", "gamma"])
  })

  it("falls back to the last confirmed order when a later reorder fails", async () => {
    const first = deferred<{ data: true }>()
    const second = deferred<{ error: string }>()
    mocks.reorderLessonItems.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    renderEditor()
    moveItemDown(0) // alpha below beta
    moveItemDown(1) // alpha below gamma
    expect(itemOrder()).toEqual(["beta", "gamma", "alpha"])
    await act(async () => first.resolve({ data: true }))
    await act(async () => second.resolve({ error: "conflict" }))
    expect(itemOrder()).toEqual(["beta", "alpha", "gamma"])
  })

  it("never lets an earlier failure overwrite a later successful reorder that completed first", async () => {
    const first = deferred<{ error: string }>()
    const second = deferred<{ data: true }>()
    mocks.reorderLessonItems.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    renderEditor()
    moveItemDown(0)
    moveItemDown(1)
    await act(async () => second.resolve({ data: true }))
    await act(async () => first.resolve({ error: "stale" }))
    expect(itemOrder()).toEqual(["beta", "gamma", "alpha"])
  })

  it("restores the lesson order when reordering lessons fails", async () => {
    mocks.reorderLessons.mockResolvedValueOnce({ error: "Invalid lessons" })
    render(<CourseEditor course={makeCourse()} {...shared} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Move lesson down" })[0])
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("failReorderLessons"))
    expect(lessonOrder()).toEqual(["Lesson One", "Lesson Two"])
  })

  it("restores the unit order when reordering units throws", async () => {
    mocks.reorderUnits.mockRejectedValueOnce(new Error("network"))
    render(<CourseEditor course={makeCourse()} {...shared} />)
    fireEvent.click(screen.getAllByRole("button", { name: "Move unit down" })[0])
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("failReorderUnits"))
    expect(unitOrder()).toEqual(["Unit One", "Unit Two"])
  })

  it("moves a lesson back out of a unit when the server rejects the move", async () => {
    mocks.setLessonUnit.mockResolvedValueOnce({ error: "Invalid unit" })
    renderEditor()
    fireEvent.change(screen.getByRole("combobox", { name: "Lesson unit" }), { target: { value: "u2" } })
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("failMoveLesson"))
    expect(screen.getByRole("combobox", { name: "Lesson unit" })).toHaveValue("none")
  })

  it("reports a rejected publish toggle instead of staying silent", async () => {
    mocks.updateCourse.mockResolvedValueOnce({ error: "Not found" })
    render(<CourseEditor course={makeCourse()} {...shared} />)
    fireEvent.click(screen.getByRole("button", { name: /Publish/ }))
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("failUpdate"))
    expect(screen.getByText("draft")).toBeInTheDocument()
  })
})
