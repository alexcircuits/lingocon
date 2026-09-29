/**
 * The slice of a lexicon needed to draw one entry's derivation tree.
 *
 * The tree used to be computed in the browser from the *entire* dictionary (the public page shipped
 * every entry for it; the studio only had its current 20-row page, so trees were silently
 * truncated). Here the server walks just the relevant neighbourhood, in the same language:
 *
 * - structured links: the `sourceEntryId` chain up to its root, then every descendant of that root;
 * - free-text links: `[word]` references in `etymology`, up to the root and back down.
 *
 * Both walks are bounded, so a pathological lexicon cannot turn one click into thousands of queries.
 */
import { prisma } from "@/lib/prisma"

export const etymologyNodeSelect = {
  id: true,
  lemma: true,
  gloss: true,
  partOfSpeech: true,
  sourceEntryId: true,
  etymology: true,
} as const

export interface EtymologyNode {
  id: string
  lemma: string
  gloss: string
  partOfSpeech: string | null
  sourceEntryId: string | null
  etymology: string | null
}

const MAX_DEPTH = 12
const MAX_NODES = 300

/** `[word]` references in a free-text etymology, e.g. "From [kar] + [-ith]". */
export function extractEtymologySources(etymology: string | null | undefined): string[] {
  if (!etymology) return []
  return (etymology.match(/\[([^\]]+)\]/g) ?? []).map((m) => m.slice(1, -1))
}

export async function getEtymologyNeighborhood(entryId: string): Promise<EtymologyNode[]> {
  const start = await prisma.dictionaryEntry.findUnique({
    where: { id: entryId },
    select: { ...etymologyNodeSelect, languageId: true },
  })
  if (!start) return []
  const { languageId } = start

  const nodes = new Map<string, EtymologyNode>()
  const add = (n: EtymologyNode) => {
    if (nodes.size < MAX_NODES) nodes.set(n.id, n)
  }
  add(start)

  // ── Structured chain: up to the root, then the root's whole subtree ──
  let root: EtymologyNode = start
  for (let depth = 0; root.sourceEntryId && depth < MAX_DEPTH; depth++) {
    const parent = await prisma.dictionaryEntry.findFirst({
      where: { id: root.sourceEntryId, languageId },
      select: etymologyNodeSelect,
    })
    if (!parent || nodes.has(parent.id)) break
    add(parent)
    root = parent
  }
  let frontier = [root.id]
  for (let depth = 0; frontier.length > 0 && depth < MAX_DEPTH && nodes.size < MAX_NODES; depth++) {
    const children = await prisma.dictionaryEntry.findMany({
      where: { languageId, sourceEntryId: { in: frontier } },
      select: etymologyNodeSelect,
      take: MAX_NODES,
    })
    frontier = children.filter((c) => !nodes.has(c.id)).map((c) => c.id)
    children.forEach(add)
  }

  // ── Free-text [word] links: up via referenced lemmas, then down via entries citing a lemma ──
  let textRoot: EtymologyNode = start
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const sources = extractEtymologySources(textRoot.etymology)
    if (sources.length === 0) break
    const parent = await prisma.dictionaryEntry.findFirst({
      where: { languageId, lemma: { in: sources }, id: { notIn: [...nodes.keys()] } },
      select: etymologyNodeSelect,
    })
    if (!parent) break
    add(parent)
    textRoot = parent
  }
  let lemmaFrontier = [textRoot.lemma]
  const visitedLemmas = new Set(lemmaFrontier)
  for (let depth = 0; lemmaFrontier.length > 0 && depth < MAX_DEPTH && nodes.size < MAX_NODES; depth++) {
    const citing = await prisma.dictionaryEntry.findMany({
      where: {
        languageId,
        OR: lemmaFrontier.map((lemma) => ({ etymology: { contains: `[${lemma}]` } })),
      },
      select: etymologyNodeSelect,
      take: MAX_NODES,
    })
    lemmaFrontier = []
    for (const c of citing) {
      add(c)
      if (!visitedLemmas.has(c.lemma)) {
        visitedLemmas.add(c.lemma)
        lemmaFrontier.push(c.lemma)
      }
    }
  }

  return [...nodes.values()]
}
