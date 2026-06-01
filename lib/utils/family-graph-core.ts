/**
 * Pure, dependency-free family-graph logic.
 *
 * This module is the single source of truth for family GRAPH STRUCTURE and
 * FAMILY RESOLUTION. It is intentionally free of any server-only imports
 * (no Prisma, no `next/*`) so it can be shared by both server components and
 * client components (the ReactFlow builder, tree stats, and the Universe map).
 *
 * DB/CTE helpers that need Prisma live in `./family-graph` and re-export
 * everything from here for backward compatibility.
 *
 * ── The two layers of "family" ───────────────────────────────────────────────
 * 1. STRUCTURE  — `parentLanguageId` (+ legacy `externalAncestry`) describes
 *    lineage: "language B descends from language A". This produces the edges.
 * 2. GROUPING   — `LanguageFamily` / `familyId` describes the named taxonomic
 *    group a language belongs to. This produces the color/cluster.
 *
 * These are orthogonal. `resolveFamilies()` reconciles them with one rule:
 *
 *   A language's EFFECTIVE family is its own `familyId` if set; otherwise it is
 *   INHERITED from the nearest ancestor in the lineage that has a `familyId`;
 *   otherwise it falls back to its lineage root (an implicit, unnamed family).
 *
 * This lets the evolution tree and the taxonomy model feel like one feature:
 * structure comes from lineage, color/grouping comes from families, and the two
 * never need to be manually kept in sync.
 */

// ─── Shared types ──────────────────────────────────────────────────────────

export interface FamilyLanguageData {
  id: string
  name: string
  slug: string
  parentLanguageId: string | null
  externalAncestry: string | null
  /** Optional: the pure graph/resolution logic never reads ownership. */
  ownerId?: string
  owner?: { id: string; name: string | null; image: string | null }
  isVirtual?: boolean
  /** Optional taxonomic family assignment (grouping layer). */
  familyId?: string | null
  family?: { id: string; name: string } | null
  _count: { dictionaryEntries: number }
}

export interface FamilyGraph {
  /** Map of id → language data (including virtual nodes) */
  byId: Map<string, FamilyLanguageData>
  /** Map of id → array of child IDs */
  childrenMap: Map<string, string[]>
  /** Root language IDs (including virtual nodes) */
  rootIds: string[]
  /** Map of external ancestry name → virtual node ID */
  virtualMap: Map<string, string>
}

/**
 * Aurora-aligned color ramp for family grouping. The first four entries are the
 * core Aurora accent tokens (violet, blue, magenta, mint) expressed as hex so
 * they can be used on a 2D canvas where CSS variables aren't available. The
 * remaining entries are harmonious extensions for graphs with many families.
 */
export const AURORA_FAMILY_COLORS = [
  "#7c5cff", // aurora violet  — hsl(252 88% 64%)
  "#3b82f6", // aurora blue    — hsl(217 91% 60%)
  "#ff4dcd", // aurora magenta — hsl(333 100% 65%)
  "#20cfa3", // aurora mint    — hsl(165 72% 48%)
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#fb7185", // rose
] as const

export interface ResolvedFamily {
  /**
   * Stable grouping key: the `familyId` when the effective family is an explicit
   * `LanguageFamily`, otherwise the lineage root node id (implicit family).
   */
  key: string
  /** Display label: family name when explicit, otherwise the root node name. */
  label: string
  /** True when grouping comes from an explicit `LanguageFamily` assignment. */
  fromFamily: boolean
  /** Index into `AURORA_FAMILY_COLORS`, assigned by first appearance. */
  colorIndex: number
  /** Resolved hex color from the Aurora ramp. */
  color: string
}

// ─── Graph construction ──────────────────────────────────────────────────────

/**
 * Build the family graph from a flat list of languages.
 *
 * Creates virtual nodes for external ancestry labels, builds a children map,
 * finds roots, and handles cycles by promoting unreachable nodes to roots.
 *
 * This is the single source of truth for graph structure, used by:
 * - Family Builder (ReactFlow layout)
 * - Tree Stats
 * - Universe Map
 */
export function buildFamilyGraph(languages: FamilyLanguageData[]): FamilyGraph {
  // Create virtual nodes for unique external ancestries
  const virtualMap = new Map<string, string>()
  languages.forEach((l) => {
    if (
      !l.parentLanguageId &&
      l.externalAncestry &&
      !virtualMap.has(l.externalAncestry)
    ) {
      virtualMap.set(
        l.externalAncestry,
        `virtual-${encodeURIComponent(l.externalAncestry)}`
      )
    }
  })

  // Combine real languages and virtual nodes
  const byId = new Map<string, FamilyLanguageData>(
    languages.map((l) => [l.id, l])
  )

  virtualMap.forEach((virtualId, ancestryName) => {
    byId.set(virtualId, {
      id: virtualId,
      name: ancestryName,
      slug: "",
      parentLanguageId: null,
      externalAncestry: null,
      ownerId: "system",
      _count: { dictionaryEntries: 0 },
      isVirtual: true,
    })
  })

  // Build children map
  const childrenMap = new Map<string, string[]>()
  byId.forEach((_, id) => childrenMap.set(id, []))

  languages.forEach((l) => {
    if (l.parentLanguageId && childrenMap.has(l.parentLanguageId)) {
      childrenMap.get(l.parentLanguageId)!.push(l.id)
    } else if (
      !l.parentLanguageId &&
      l.externalAncestry &&
      virtualMap.has(l.externalAncestry)
    ) {
      childrenMap.get(virtualMap.get(l.externalAncestry)!)!.push(l.id)
    }
  })

  // Sort children alphabetically for consistent ordering
  childrenMap.forEach((kids) => {
    kids.sort((a, b) => {
      const nameA = byId.get(a)?.name || ""
      const nameB = byId.get(b)?.name || ""
      return nameA.localeCompare(nameB)
    })
  })

  // Find roots
  const roots = Array.from(byId.values())
    .filter((l) => {
      if (l.isVirtual) return true
      if (l.parentLanguageId && byId.has(l.parentLanguageId)) return false
      if (l.externalAncestry && virtualMap.has(l.externalAncestry)) return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Handle disconnected cycles — promote unreachable nodes to roots
  const reachable = new Set<string>()
  function markReachable(id: string) {
    if (reachable.has(id)) return
    reachable.add(id)
    ;(childrenMap.get(id) || []).forEach(markReachable)
  }
  roots.forEach((r) => markReachable(r.id))

  const unreached = Array.from(byId.values())
    .filter((l) => !reachable.has(l.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  unreached.forEach((l) => {
    if (!reachable.has(l.id)) {
      roots.push(l)
      markReachable(l.id)
    }
  })

  return {
    byId,
    childrenMap,
    rootIds: roots.map((r) => r.id),
    virtualMap,
  }
}

// ─── Family resolution (reconciles lineage + taxonomy) ───────────────────────

/**
 * Resolve every node's EFFECTIVE family by walking each lineage tree top-down
 * and inheriting the nearest ancestor's `familyId`, unless the node overrides
 * it with its own. Returns a map of node id → {@link ResolvedFamily}, including
 * a stable Aurora color per distinct family.
 *
 * Color indices are assigned by first appearance over the (alphabetically
 * sorted) roots, so the same graph always yields the same colors.
 */
export function resolveFamilies(
  graph: FamilyGraph
): Map<string, ResolvedFamily> {
  const { byId, childrenMap, rootIds } = graph
  const result = new Map<string, ResolvedFamily>()

  const colorByKey = new Map<string, number>()
  const colorIndexFor = (key: string): number => {
    if (!colorByKey.has(key)) colorByKey.set(key, colorByKey.size)
    return colorByKey.get(key)!
  }

  type Ctx = { key: string; label: string; fromFamily: boolean }

  const contextFor = (node: FamilyLanguageData, inherited: Ctx | null): Ctx => {
    if (node.familyId) {
      return {
        key: node.familyId,
        label: node.family?.name ?? node.name,
        fromFamily: true,
      }
    }
    if (inherited) return inherited
    return { key: node.id, label: node.name, fromFamily: false }
  }

  const visited = new Set<string>()
  const walk = (id: string, inherited: Ctx | null) => {
    if (visited.has(id)) return
    visited.add(id)
    const node = byId.get(id)
    if (!node) return

    const ctx = contextFor(node, inherited)
    const colorIndex = colorIndexFor(ctx.key)
    result.set(id, {
      ...ctx,
      colorIndex,
      color: AURORA_FAMILY_COLORS[colorIndex % AURORA_FAMILY_COLORS.length],
    })

    for (const kid of childrenMap.get(id) || []) walk(kid, ctx)
  }

  rootIds.forEach((r) => walk(r, null))
  return result
}
