"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { GitFork, ArrowRight } from "lucide-react"
import type { DictionaryEntry } from "@prisma/client"

interface EtymologyTreeProps {
  /** The entry to show the tree for */
  entry: DictionaryEntry
  /** All dictionary entries in the language (for building the tree) */
  allEntries: DictionaryEntry[]
  /** Callback when clicking a word node */
  onSelectEntry?: (entry: DictionaryEntry) => void
  /** Whether to use custom script font */
  useCustomFont?: boolean
}

interface TreeNode {
  entry: DictionaryEntry
  children: TreeNode[]
  isRoot?: boolean
}

/**
 * Parse etymology text to extract source word references.
 * Handles formats like:
 *   "Derived from [word]..."
 *   "Compound of [word1] + [word2]"
 */
function extractEtymologySources(etymology: string): string[] {
  const matches = etymology.match(/\[([^\]]+)\]/g)
  if (!matches) return []
  return matches.map(m => m.slice(1, -1))
}

/**
 * Build a derivation tree rooted at the given entry.
 * Walks both up (ancestors via etymology) and down (descendants that reference this entry).
 */
function buildTree(
  entry: DictionaryEntry,
  allEntries: DictionaryEntry[],
  visited: Set<string> = new Set()
): TreeNode {
  visited.add(entry.id)

  // Find children: entries whose etymology references this entry's lemma
  // or whose relatedWords includes this entry's lemma AND have etymology text
  const children = allEntries
    .filter(e => {
      if (visited.has(e.id)) return false
      if (!e.etymology) return false
      const sources = extractEtymologySources(e.etymology)
      return sources.includes(entry.lemma)
    })
    .map(child => buildTree(child, allEntries, visited))

  return { entry, children }
}

/**
 * Find the root ancestor of an entry by walking up the etymology chain.
 */
function findRoot(
  entry: DictionaryEntry,
  allEntries: DictionaryEntry[],
  visited: Set<string> = new Set()
): DictionaryEntry {
  visited.add(entry.id)

  if (!entry.etymology) return entry

  const sources = extractEtymologySources(entry.etymology)
  if (sources.length === 0) return entry

  // Find the first source entry that exists
  const sourceEntry = allEntries.find(
    e => sources.includes(e.lemma) && !visited.has(e.id)
  )

  if (!sourceEntry) return entry

  return findRoot(sourceEntry, allEntries, visited)
}

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
  const hasChildren = node.children.length > 0

  return (
    <div className="relative">
      {/* Node */}
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

      {/* Children */}
      {hasChildren && (
        <div className="ml-4 mt-1 pl-4 border-l-2 border-border/30 space-y-1">
          {node.children.map(child => (
            <div key={child.entry.id} className="relative">
              {/* Branch connector */}
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

export function EtymologyTree({
  entry,
  allEntries,
  onSelectEntry,
  useCustomFont = true,
}: EtymologyTreeProps) {
  const tree = useMemo(() => {
    // Find root of the derivation chain
    const root = findRoot(entry, allEntries)
    // Build tree from root
    return buildTree(root, allEntries)
  }, [entry, allEntries])

  // Check if there's actually a tree (more than just the entry itself)
  const hasTree = tree.children.length > 0 || tree.entry.id !== entry.id

  if (!hasTree) return null

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
