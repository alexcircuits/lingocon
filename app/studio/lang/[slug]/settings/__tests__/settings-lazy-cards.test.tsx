import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ cardLoads: 0, collaboratorLoads: 0 }))
// Count module evaluations: a code-split card's module is evaluated when its chunk loads.
vi.mock("../parent-language-card-impl", () => {
  mocks.cardLoads++
  return { ParentLanguageCard: ({ currentSlug }: { currentSlug: string }) => <section>family card for {currentSlug}</section> }
})
vi.mock("../collaborators-impl", () => {
  mocks.collaboratorLoads++
  return {
    Collaborators: ({ languageSlug }: { languageSlug: string }) => <section>collaborators of {languageSlug}</section>,
    TransferOwnershipCard: ({ languageSlug }: { languageSlug: string }) => <section>transfer {languageSlug}</section>,
  }
})
import { ParentLanguageCard } from "../parent-language-card"
import { Collaborators, TransferOwnershipCard } from "../collaborators"

const cardProps = {
  languageId: "lang-1", currentParentId: null, initialParent: null, initialFamilyId: null,
  initialFamily: null, familyTree: null, currentSlug: "lingua", isOwner: true,
}

describe("code-split settings cards", () => {
  it("are not part of the page module: each loads when first rendered, behind a card outline", async () => {
    expect(mocks.cardLoads).toBe(0)
    expect(mocks.collaboratorLoads).toBe(0)

    const view = render(
      <>
        <ParentLanguageCard {...cardProps} />
        <Collaborators languageId="lang-1" languageSlug="lingua" isOwner />
      </>
    )
    expect(view.container.querySelectorAll("[aria-busy='true']")).toHaveLength(2)

    expect(await screen.findByText("family card for lingua")).toBeInTheDocument()
    expect(await screen.findByText("collaborators of lingua")).toBeInTheDocument()
    expect(view.container.querySelector("[aria-busy='true']")).toBeNull()

    // The ownership card comes from the same chunk. (Rendered after the first load settles:
    // vitest resolves two concurrent dynamic imports of one mocked module inconsistently.)
    view.rerender(
      <>
        <ParentLanguageCard {...cardProps} />
        <Collaborators languageId="lang-1" languageSlug="lingua" isOwner />
        <TransferOwnershipCard languageId="lang-1" languageSlug="lingua" />
      </>
    )
    expect(await screen.findByText("transfer lingua")).toBeInTheDocument()
    expect(mocks.cardLoads).toBe(1)
    expect(mocks.collaboratorLoads).toBe(1)
  })
})
