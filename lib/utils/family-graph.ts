/**
 * Server-only family-graph helpers.
 *
 * Provides CTE-based SQL helpers for ancestor/descendant queries (single-query,
 * no N+1). The pure, client-safe graph-building and family-resolution logic
 * lives in `./family-graph-core` and is re-exported here so existing
 * server-side imports keep working unchanged.
 *
 * IMPORTANT: client components must import graph logic from
 * `@/lib/utils/family-graph-core` directly — importing from this module pulls
 * Prisma into the bundle.
 */

import { prisma } from "@/lib/prisma"

export * from "./family-graph-core"

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
