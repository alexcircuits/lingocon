"use client"

import { useMemo } from "react"
import { BarChart3, GitFork, BookOpen, Layers, TrendingUp } from "lucide-react"
import { buildFamilyGraph, type FamilyLanguageData } from "@/lib/utils/family-graph"

interface TreeStatsProps {
  languages: FamilyLanguageData[]
}

function computeStats(languages: FamilyLanguageData[]) {
  const { childrenMap, rootIds } = buildFamilyGraph(languages)

  // Compute max depth via DFS (uses single shared visited set — O(n) instead of O(n²))
  function maxDepth(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0
    visited.add(id)
    const kids = childrenMap.get(id) || []
    if (kids.length === 0) return 1
    let deepest = 0
    for (const kid of kids) {
      deepest = Math.max(deepest, maxDepth(kid, visited))
    }
    return 1 + deepest
  }

  const depth = rootIds.length > 0
    ? Math.max(...rootIds.map(r => maxDepth(r, new Set<string>())))
    : 0

  // Total words
  const totalWords = languages.reduce((sum, l) => sum + (l._count.dictionaryEntries || 0), 0)

  // Average words per language (only languages with words)
  const langsWithWords = languages.filter(l => l._count.dictionaryEntries > 0)
  const avgWords = langsWithWords.length > 0
    ? Math.round(totalWords / langsWithWords.length)
    : 0

  // Widest level (max nodes at any depth)
  function countAtDepth(id: string, d: number, target: number, visited: Set<string>): number {
    if (visited.has(id)) return 0
    visited.add(id)
    if (d === target) return 1
    const kids = childrenMap.get(id) || []
    return kids.reduce((sum, kid) => sum + countAtDepth(kid, d + 1, target, visited), 0)
  }
  
  let maxBreadth = 0
  for (let d = 0; d < depth; d++) {
    const breadth = rootIds.reduce((sum, r) => sum + countAtDepth(r, 0, d, new Set<string>()), 0)
    maxBreadth = Math.max(maxBreadth, breadth)
  }

  // Count distinct family trees
  const familyGroups = new Set<string>()
  rootIds.forEach(r => {
    const lang = languages.find(l => l.id === r)
    familyGroups.add(lang?.externalAncestry || r)
  })

  return {
    totalLanguages: languages.length,
    familyCount: familyGroups.size,
    maxDepth: depth,
    maxBreadth,
    totalWords,
    avgWords,
    rootCount: rootIds.length,
  }
}

export function TreeStats({ languages }: TreeStatsProps) {
  if (languages.length === 0) return null

  const stats = computeStats(languages)

  const items = [
    { icon: Layers, label: "Languages", value: stats.totalLanguages, color: "text-blue-500" },
    { icon: GitFork, label: "Families", value: stats.familyCount, color: "text-purple-500" },
    { icon: TrendingUp, label: "Max Depth", value: stats.maxDepth, color: "text-emerald-500" },
    { icon: BookOpen, label: "Total Words", value: stats.totalWords.toLocaleString(), color: "text-amber-500" },
    { icon: BarChart3, label: "Avg Words/Lang", value: stats.avgWords, color: "text-rose-500" },
  ]

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Tree Statistics
      </h3>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 bg-secondary/30 rounded-lg px-2.5 py-1.5"
          >
            <item.icon className={`h-3.5 w-3.5 ${item.color} shrink-0`} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium leading-tight truncate">{item.value}</div>
              <div className="text-[9px] text-muted-foreground leading-tight">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
