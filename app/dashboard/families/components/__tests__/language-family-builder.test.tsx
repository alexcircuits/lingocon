import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import type { Connection, Edge, Node, NodeChange } from "reactflow"

const flow = vi.hoisted(() => ({
  onNodesChange: null as null | ((changes: NodeChange[]) => void),
  onConnect: null as null | ((connection: Connection) => void),
  api: { fitView: () => undefined, setCenter: () => undefined },
}))

// Render the graph as plain text so tests can read node data, positions and edges.
vi.mock("reactflow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("reactflow")>()
  function FakeFlow({ nodes, edges, onNodesChange, onConnect, children }: {
    nodes: Node[]; edges: Edge[]; children?: ReactNode
    onNodesChange: (changes: NodeChange[]) => void; onConnect: (connection: Connection) => void
  }) {
    flow.onNodesChange = onNodesChange
    flow.onConnect = onConnect
    return (
      <div>
        <ul>{nodes.map((n) => <li key={n.id} data-testid={`node-${n.id}`}>{`${n.data.label}|${n.data.count}|${n.position.x},${n.position.y}`}</li>)}</ul>
        <ul>{edges.map((e) => <li key={e.id} data-testid="edge">{`${e.source}->${e.target}`}</li>)}</ul>
        {children}
      </div>
    )
  }
  return {
    ...actual,
    default: FakeFlow,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useReactFlow: () => flow.api,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  }
})
vi.mock("../tree-stats", () => ({ TreeStats: () => null }))
vi.mock("../compare-modal", () => ({ CompareModal: () => null }))
vi.mock("../derivation-panel", () => ({ DerivationPanel: () => null }))
vi.mock("@/app/actions/language-family", () => ({ setParentLanguage: vi.fn(), setLanguageFamily: vi.fn() }))

import { LanguageFamilyBuilder } from "../language-family-builder"

const lang = (id: string, name: string, count: number, parentLanguageId: string | null = null) => ({
  id, name, slug: id, parentLanguageId, externalAncestry: null, familyId: null, family: null,
  ownerId: "me", owner: { id: "me", name: "Me", image: null }, _count: { dictionaryEntries: count },
})

beforeAll(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number)
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id))
})
afterEach(() => cleanup())

const nodeText = (id: string) => screen.getByTestId(`node-${id}`).textContent
const edgeTexts = () => screen.queryAllByTestId("edge").map((e) => e.textContent)

async function renderBuilder(languages: ReturnType<typeof lang>[]) {
  const view = render(<LanguageFamilyBuilder initialLanguages={languages} currentUserId="me" />)
  await screen.findByTestId(`node-${languages[0].id}`)
  return view
}

function dragNode(id: string, x: number, y: number) {
  act(() => flow.onNodesChange!([{ type: "position", id, position: { x, y }, dragging: false }]))
}

describe("family builder resyncs node data from refreshed props", () => {
  it("shows refreshed word counts after derivation while keeping user-arranged positions", async () => {
    const view = await renderBuilder([lang("proto", "Proto", 10), lang("daughter", "Daughter", 3, "proto")])
    dragNode("daughter", 999, 555)
    expect(nodeText("daughter")).toBe("Daughter|3|999,555")

    view.rerender(<LanguageFamilyBuilder initialLanguages={[lang("proto", "Proto", 10), lang("daughter", "Daughter", 7, "proto")]} currentUserId="me" />)

    expect(nodeText("daughter")).toBe("Daughter|7|999,555")
    expect(edgeTexts()).toEqual(["proto->daughter"])
  })

  it("adds languages that appear and drops languages that disappear", async () => {
    const view = await renderBuilder([lang("proto", "Proto", 1), lang("gone", "Gone", 1, "proto")])
    view.rerender(<LanguageFamilyBuilder initialLanguages={[lang("proto", "Proto", 1), lang("fresh", "Fresh", 2, "proto")]} currentUserId="me" />)
    expect(screen.queryByTestId("node-gone")).not.toBeInTheDocument()
    expect(nodeText("fresh")).toMatch(/^Fresh\|2\|/)
    expect(edgeTexts()).toEqual(["proto->fresh"])
  })

  it("keeps unsaved connection edits when refreshed props arrive, and undo never restores stale data", async () => {
    const languages = [lang("a", "Alpha", 1), lang("b", "Beta", 1), lang("child", "Child", 1, "a")]
    const view = await renderBuilder(languages)
    act(() => flow.onConnect!({ source: "b", target: "child", sourceHandle: null, targetHandle: null }))
    expect(edgeTexts()).toEqual(["b->child"])

    view.rerender(<LanguageFamilyBuilder initialLanguages={languages.map((l) => l.id === "child" ? { ...l, _count: { dictionaryEntries: 4 } } : l)} currentUserId="me" />)

    expect(edgeTexts()).toEqual(["b->child"])
    expect(nodeText("child")).toMatch(/^Child\|4\|/)
    expect(screen.getByRole("button", { name: /Save Tree \(1 changes\)/ })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: /Undo/ }))
    expect(edgeTexts()).toEqual(["a->child"])
    expect(nodeText("child")).toMatch(/^Child\|4\|/)
  })
})
