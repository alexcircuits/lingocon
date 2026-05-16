"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { GitFork, ArrowRight } from "lucide-react"
import type { DictionaryEntry } from "@prisma/client"

interface EtymologyTreeProps {
  entry: DictionaryEntry
  allEntries: DictionaryEntry[]
  onSelectEntry?: (entry: DictionaryEntry) => void
  useCustomFont?: boolean
}

interface TreeNode {
  entry: DictionaryEntry
  children: TreeNode[]
}

// ---------------------------------------------------------------------------
// Primary strategy: use the structured sourceEntryId cognate chain
// ---------------------------------------------------------------------------

function buildStructuredTree(
  rootId: string,
  entryMap: Map<string, DictionaryEntry>,
  childrenMap: Map<string, string[]>,
  visited: Set<string> = new Set()
): TreeNode | null {
  if (visited.has(rootId)) return null
  visited.add(rootId)

  const entry = entryMap.get(rootId)
  if (!entry) return null

  const children = (childrenMap.get(rootId) ?? [])
    .map(childId => buildStructuredTree(childId, entryMap, childrenMap, visited))
    .filter((n): n is TreeNode => n !== null)

  return { entry, children }
}

/** Walk sourceEntryId upward to find the root of the cognate chain. */
function findStructuredRoot(
  entry: DictionaryEntry,
  entryMap: Map<string, DictionaryEntry>,
  visited: Set<string> = new Set()
): DictionaryEntry {
  if (!entry.sourceEntryId || visited.has(entry.id)) return entry
  visited.add(entry.id)
  const parent = entryMap.get(entry.sourceEntryId)
  if (!parent) return entry
  return findStructuredRoot(parent, entryMap, visited)
}

// ---------------------------------------------------------------------------
// Fallback strategy: parse free-text etymology field for [word] references
// ---------------------------------------------------------------------------

function extractEtymologySources(etymology: string): string[] {
  const matches = etymology.match(/\[([^\]]+)\]/g)
  if (!matches) return []
  return matches.map(m => m.slice(1, -1))
}

function buildTextTree(
  entry: DictionaryEntry,
  allEntries: DictionaryEntry[],
  visited: Set<string> = new Set()
): TreeNode {
  visited.add(entry.id)

  const children = allEntries
    .filter(e => {
      if (visited.has(e.id) || !e.etymology) return false
      return extractEtymologySources(e.etymology).includes(entry.lemma)
    })
    .map(child => buildTextTree(child, allEntries, visited))

  return { entry, children }
}

function findTextRoot(
  entry: DictionaryEntry,
  allEntries: DictionaryEntry[],
  visited: Set<string> = new Set()
): DictionaryEntry {
  if (!entry.etymology || visited.has(entry.id)) return entry
  visited.add(entry.id)

  const sources = extractEtymologySources(entry.etymology)
  const parent = allEntries.find(e => sources.includes(e.lemma) && !visited.has(e.id))
  if (!parent) return entry
  return findTextRoot(parent, allEntries, visited)
}

// ---------------------------------------------------------------------------
// Node view
// ---------------------------------------------------------------------------

function TreeNodeView({
  node,
  currentEntryId,
  onSelectEntry,
  depth = 0,
  useCustomFont,
}: {
  node: TreeNode
  currentEntryId: string
  onSelectEntry?: (entry: DictionaryEntry) => void
  depth?: number
  useCustomFont?: boolean
}) {
  const isCurrent = node.entry.id === currentEntryId

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelectEntry?.(node.entry)}
        className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:border-primary/50 hover:shadow-sm ${
          isCurrent
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-border/50 bg-card hover:bg-muted/30"
        }`}
      >
        <div className="min-w-0">
          <div className={`font-medium text-sm truncate ${useCustomFont ? "font-custom-script" : ""}`}>
            {node.entry.lemma}
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[160px]">
            {node.entry.gloss}
          </div>
        </div>
        {node.entry.partOfSpeech && (
          <Badge variant="outline" className="text-[10px] shrink-0 px-1 py-0">
            {node.entry.partOfSpeech}
          </Badge>
        )}
      </button>

      {node.children.length > 0 && (
        <div className="ml-4 mt-1 pl-4 border-l-2 border-border/30 space-y-1">
          {node.children.map(child => (
            <div key={child.entry.id} className="relative">
              <div className="absolute -left-4 top-4 w-4 border-t-2 border-border/30" />
              <div className="flex items-start gap-1.5">
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 mt-3 shrink-0" />
                <TreeNodeView
                  node={child}
                  currentEntryId={currentEntryId}
                  onSelectEntry={onSelectEntry}
                  depth={depth + 1}
                  useCustomFont={useCustomFont}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function EtymologyTree({
  entry,
  allEntries,
  onSelectEntry,
  useCustomFont = true,
}: EtymologyTreeProps) {
  const tree = useMemo(() => {
    const entryMap = new Map(allEntries.map(e => [e.id, e]))

    // --- Primary: structured cognate chain via sourceEntryId ---
    const hasStructuredLinks = allEntries.some(e => e.sourceEntryId !== null)

    if (hasStructuredLinks) {
      // Build parent→children map
      const childrenMap = new Map<string, string[]>()
      for (const e of allEntries) {
        if (e.sourceEntryId) {
          const siblings = childrenMap.get(e.sourceEntryId) ?? []
          siblings.push(e.id)
          childrenMap.set(e.sourceEntryId, siblings)
        }
      }

      const root = findStructuredRoot(entry, entryMap)
      const result = buildStructuredTree(root.id, entryMap, childrenMap)
      if (result && (result.children.length > 0 || result.entry.id !== entry.id)) {
        return result
      }
    }

    // --- Fallback: parse free-text [word] references in etymology field ---
    const hasTextLinks = allEntries.some(
      e => e.etymology && extractEtymologySources(e.etymology).length > 0
    )
    if (!hasTextLinks) return null

    const root = findTextRoot(entry, allEntries)
    const result = buildTextTree(root, allEntries)
    if (result.children.length === 0 && result.entry.id === entry.id) return null
    return result
  }, [entry, allEntries])

  if (!tree) return null

  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <GitFork className="h-4 w-4" />
        Derivation Tree
      </h4>
      <div className="rounded-lg border bg-muted/20 p-3 overflow-x-auto">
        <TreeNodeView
          node={tree}
          currentEntryId={entry.id}
          onSelectEntry={onSelectEntry}
          useCustomFont={useCustomFont}
        />
      </div>
    </div>
  )
}
