/**
 * Shared family-graph utilities for the Language Family feature.
 *
 * Provides:
 * - CTE-based SQL helpers for ancestor/descendant queries (single-query, no N+1)
 * - Shared graph-building logic used by the builder, stats, and map components
 */

import { prisma } from "@/lib/prisma"

// ─── CTE-based DB Helpers ──────────────────────────────────────────────────

/**
 * Find the root ancestor of a language by walking up the parent chain.
 * Uses a single recursive CTE instead of N serial queries.
 */
export async function findRootId(languageId: string): Promise<string> {
  const result = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE ancestor_chain AS (
      SELECT id, "parentLanguageId"
      FROM languages
      WHERE id = ${languageId}
      UNION ALL
      SELECT l.id, l."parentLanguageId"
      FROM languages l
      JOIN ancestor_chain ac ON l.id = ac."parentLanguageId"
    )
    SELECT id FROM ancestor_chain
    WHERE "parentLanguageId" IS NULL
    LIMIT 1
  `
  return result.length > 0 ? result[0].id : languageId
}

/**
 * Get all descendant IDs of a language (the full subtree below it).
 * Uses a single recursive CTE instead of BFS with N batched queries.
 */
export async function getDescendantIds(languageId: string): Promise<string[]> {
  const result = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM languages WHERE "parentLanguageId" = ${languageId}
      UNION ALL
      SELECT l.id
      FROM languages l
      JOIN descendants d ON l."parentLanguageId" = d.id
    )
    SELECT id FROM descendants
  `
  return result.map((r) => r.id)
}

/**
 * Check if setting `proposedParentId` as the parent of `childId`
 * would create a circular reference.
 *
 * Works by walking up from proposedParentId to see if we ever reach childId.
 * Returns true if circular, false if safe.
 */
export async function hasCircularReference(
  childId: string,
  proposedParentId: string
): Promise<boolean> {
  if (childId === proposedParentId) return true

  const result = await prisma.$queryRaw<{ found: boolean }[]>`
    WITH RECURSIVE ancestor_chain AS (
      SELECT id, "parentLanguageId"
      FROM languages
      WHERE id = ${proposedParentId}
      UNION ALL
      SELECT l.id, l."parentLanguageId"
      FROM languages l
      JOIN ancestor_chain ac ON l.id = ac."parentLanguageId"
    )
    SELECT EXISTS (
      SELECT 1 FROM ancestor_chain WHERE id = ${childId}
    ) AS found
  `
  return result.length > 0 && result[0].found === true
}

/**
 * Fetch all ancestor language IDs for a set of languages.
 * Given a set of language IDs, walks UP the parent chain and returns
 * all ancestor IDs that are NOT already in the input set.
 *
 * Used by the families dashboard page to batch-fetch missing ancestors.
 */
export async function getAncestorIds(languageIds: string[]): Promise<string[]> {
  if (languageIds.length === 0) return []

  const result = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE ancestor_chain AS (
      SELECT "parentLanguageId" AS id
      FROM languages
      WHERE id = ANY(${languageIds})
        AND "parentLanguageId" IS NOT NULL
      UNION ALL
      SELECT l."parentLanguageId"
      FROM languages l
      JOIN ancestor_chain ac ON l.id = ac.id
      WHERE l."parentLanguageId" IS NOT NULL
    )
    SELECT DISTINCT id FROM ancestor_chain
    WHERE id != ALL(${languageIds})
  `
  return result.map((r) => r.id)
}

// ─── Shared Graph-Building Logic ───────────────────────────────────────────

export interface FamilyLanguageData {
  id: string
  name: string
  slug: string
  parentLanguageId: string | null
  externalAncestry: string | null
  ownerId: string
  owner?: { id: string; name: string | null; image: string | null }
  isVirtual?: boolean
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
