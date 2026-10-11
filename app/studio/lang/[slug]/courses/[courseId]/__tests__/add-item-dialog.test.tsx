import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/app/actions/learn", () => ({
  addLessonItem: vi.fn(), createAndAddSentence: vi.fn(), createAndAddVocab: vi.fn(),
  searchDictEntries: vi.fn(async () => []), searchCourseSentences: vi.fn(async () => []),
}))
import { AddItemDialog } from "../add-item-dialog"
import { StudioAccessProvider } from "@/components/studio-access"

type Access = { isOwner: boolean; fullAccess: boolean; permissions: string[] }
const withAccess = (access: Access) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <StudioAccessProvider value={access}>{children}</StudioAccessProvider>
  }
const courseEditor = (permissions: string[]): Access => ({ isOwner: false, fullAccess: false, permissions })

async function openDialog(access: Access) {
  render(
    <AddItemDialog lessonId="lesson-1" languageId="lang-1" slug="lingua" grammarPages={[]} texts={[]} onAdded={vi.fn()} />,
    { wrapper: withAccess(access) }
  )
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "addItem" })) })
}

afterEach(cleanup)

describe("course add-item dialog access", () => {
  it("only offers picking existing words to a course editor without the dictionary scope", async () => {
    await openDialog(courseEditor(["write:grammar"]))
    expect(screen.getByText("noContentYet")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "writeNew" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "writeNewInstead" })).not.toBeInTheDocument()
  })

  it("offers writing a new word to a course editor with write:dictionary", async () => {
    await openDialog(courseEditor(["write:dictionary"]))
    expect(screen.getByRole("button", { name: "writeNew" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "writeNewInstead" })).toBeInTheDocument()
  })
})
