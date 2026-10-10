import { DndContext } from "@dnd-kit/core"
import { SortableContext } from "@dnd-kit/sortable"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SortableSymbol } from "../sortable-symbol"

const symbol = {
  id: "s-c", symbol: "c", capitalSymbol: "C", ipa: "k", latin: "c", name: null, order: 2,
  languageId: "lang-1", createdAt: new Date(), updatedAt: new Date(),
}
function card(readOnly: boolean) {
  return (
    <DndContext>
      <SortableContext items={[symbol.id]}>
        <SortableSymbol
          symbol={symbol} index={0} totalCount={1} isPending={false} readOnly={readOnly}
          onEdit={vi.fn()} onDelete={vi.fn()} onReorder={vi.fn()}
        />
      </SortableContext>
    </DndContext>
  )
}

afterEach(cleanup)

describe("alphabet symbol card", () => {
  it("shows the symbol without a drag handle or actions menu when read-only", () => {
    render(card(true))
    expect(screen.getByText("C")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Drag to reorder" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Actions for c" })).not.toBeInTheDocument()
  })

  it("offers the drag handle and actions menu to editors", () => {
    render(card(false))
    expect(screen.getByRole("button", { name: "Drag to reorder" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Actions for c" })).toBeInTheDocument()
  })
})
