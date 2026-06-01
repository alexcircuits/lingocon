import { describe, it, expect } from "vitest"
import {
  buildFamilyGraph,
  resolveFamilies,
  AURORA_FAMILY_COLORS,
  type FamilyLanguageData,
} from "../family-graph-core"

function lang(
  id: string,
  overrides: Partial<FamilyLanguageData> = {}
): FamilyLanguageData {
  return {
    id,
    name: overrides.name ?? id,
    slug: overrides.slug ?? id.toLowerCase(),
    parentLanguageId: overrides.parentLanguageId ?? null,
    externalAncestry: overrides.externalAncestry ?? null,
    familyId: overrides.familyId ?? null,
    family: overrides.family ?? null,
    _count: overrides._count ?? { dictionaryEntries: 0 },
    ...overrides,
  }
}

describe("buildFamilyGraph", () => {
  it("builds a parent → child tree and detects the root", () => {
    const graph = buildFamilyGraph([
      lang("A"),
      lang("B", { parentLanguageId: "A" }),
      lang("C", { parentLanguageId: "B" }),
    ])

    expect(graph.rootIds).toEqual(["A"])
    expect(graph.childrenMap.get("A")).toEqual(["B"])
    expect(graph.childrenMap.get("B")).toEqual(["C"])
    expect(graph.childrenMap.get("C")).toEqual([])
  })

  it("sorts sibling children alphabetically by name", () => {
    const graph = buildFamilyGraph([
      lang("root", { name: "Root" }),
      lang("z", { name: "Zeta", parentLanguageId: "root" }),
      lang("a", { name: "Alpha", parentLanguageId: "root" }),
    ])
    expect(graph.childrenMap.get("root")).toEqual(["a", "z"])
  })

  it("creates a virtual node for external ancestry and parents the language under it", () => {
    const graph = buildFamilyGraph([
      lang("D", { name: "Daughter", externalAncestry: "Proto-X" }),
    ])

    const virtualId = graph.virtualMap.get("Proto-X")
    expect(virtualId).toBeDefined()
    expect(graph.rootIds).toEqual([virtualId])
    expect(graph.childrenMap.get(virtualId!)).toEqual(["D"])
    expect(graph.byId.get(virtualId!)?.isVirtual).toBe(true)
  })

  it("promotes nodes trapped in a cycle to roots so they remain reachable", () => {
    // A ↔ B mutually reference each other (no real root).
    const graph = buildFamilyGraph([
      lang("A", { parentLanguageId: "B" }),
      lang("B", { parentLanguageId: "A" }),
    ])
    // Both nodes must still appear and be reachable from some root.
    expect(graph.rootIds.length).toBeGreaterThan(0)
    expect(graph.byId.has("A")).toBe(true)
    expect(graph.byId.has("B")).toBe(true)
  })
})

describe("resolveFamilies", () => {
  it("inherits the nearest ancestor's family down the lineage", () => {
    const graph = buildFamilyGraph([
      lang("A", { familyId: "fam1", family: { id: "fam1", name: "Elvish" } }),
      lang("B", { parentLanguageId: "A" }),
      lang("C", { parentLanguageId: "B" }),
    ])
    const resolved = resolveFamilies(graph)

    expect(resolved.get("A")).toMatchObject({ key: "fam1", label: "Elvish", fromFamily: true })
    expect(resolved.get("B")).toMatchObject({ key: "fam1", label: "Elvish", fromFamily: true })
    expect(resolved.get("C")).toMatchObject({ key: "fam1", label: "Elvish", fromFamily: true })
  })

  it("lets a descendant override the inherited family for its own subtree", () => {
    const graph = buildFamilyGraph([
      lang("A", { familyId: "fam1", family: { id: "fam1", name: "Elvish" } }),
      lang("B", {
        parentLanguageId: "A",
        familyId: "fam2",
        family: { id: "fam2", name: "Dwarvish" },
      }),
      lang("C", { parentLanguageId: "B" }),
    ])
    const resolved = resolveFamilies(graph)

    expect(resolved.get("A")?.key).toBe("fam1")
    expect(resolved.get("B")).toMatchObject({ key: "fam2", label: "Dwarvish" })
    expect(resolved.get("C")?.key).toBe("fam2") // inherits the override
  })

  it("falls back to the lineage root as an implicit, unnamed family", () => {
    const graph = buildFamilyGraph([
      lang("A"),
      lang("B", { parentLanguageId: "A" }),
    ])
    const resolved = resolveFamilies(graph)

    expect(resolved.get("A")).toMatchObject({ key: "A", fromFamily: false })
    expect(resolved.get("B")?.key).toBe("A")
  })

  it("assigns a stable Aurora color per distinct family", () => {
    const graph = buildFamilyGraph([
      lang("A", { name: "A", familyId: "fam1", family: { id: "fam1", name: "One" } }),
      lang("B", { name: "B", familyId: "fam2", family: { id: "fam2", name: "Two" } }),
    ])
    const resolved = resolveFamilies(graph)

    const a = resolved.get("A")!
    const b = resolved.get("B")!
    expect(a.color).toBe(AURORA_FAMILY_COLORS[a.colorIndex])
    expect(b.color).toBe(AURORA_FAMILY_COLORS[b.colorIndex])
    expect(a.colorIndex).not.toBe(b.colorIndex)
  })
})
