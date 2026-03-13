"use client"

import { BarChart3, GitFork, BookOpen, Layers, TrendingUp } from "lucide-react"

interface LanguageData {
  id: string
  name: string
  slug: string
  parentLanguageId: string | null
  externalAncestry: string | null
  ownerId: string
  _count: {
    dictionaryEntries: number
  }
}

interface TreeStatsProps {
  languages: LanguageData[]
}

function computeStats(languages: LanguageData[]) {
  const byId = new Map(languages.map(l => [l.id, l]))
  const childrenMap = new Map<string, string[]>()
  byId.forEach((_, id) => childrenMap.set(id, []))
  
  languages.forEach(l => {
    if (l.parentLanguageId && childrenMap.has(l.parentLanguageId)) {
      childrenMap.get(l.parentLanguageId)!.push(l.id)
    }
  })

  // Find roots
  const roots = languages.filter(l => !l.parentLanguageId || !byId.has(l.parentLanguageId))

  // Compute max depth via DFS
  function maxDepth(id: string): number {
    const kids = childrenMap.get(id) || []
    if (kids.length === 0) return 1
    return 1 + Math.max(...kids.map(maxDepth))
  }

  const depth = roots.length > 0 ? Math.max(...roots.map(r => maxDepth(r.id))) : 0

  // Total words
  const totalWords = languages.reduce((sum, l) => sum + (l._count.dictionaryEntries || 0), 0)

  // Average words per language (only languages with words)
  const langsWithWords = languages.filter(l => l._count.dictionaryEntries > 0)
  const avgWords = langsWithWords.length > 0
    ? Math.round(totalWords / langsWithWords.length)
    : 0

  // Widest level (max siblings at any depth)
  function countAtDepth(id: string, d: number, target: number): number {
    if (d === target) return 1
    const kids = childrenMap.get(id) || []
    return kids.reduce((sum, kid) => sum + countAtDepth(kid, d + 1, target), 0)
  }
  
  let maxBreadth = 0
  for (let d = 0; d < depth; d++) {
    const breadth = roots.reduce((sum, r) => sum + countAtDepth(r.id, 0, d), 0)
    maxBreadth = Math.max(maxBreadth, breadth)
  }

  // Count distinct family trees
  const familyGroups = new Set<string>()
  roots.forEach(r => {
    familyGroups.add(r.externalAncestry || r.id)
  })

  return {
    totalLanguages: languages.length,
    familyCount: familyGroups.size,
    maxDepth: depth,
    maxBreadth,
    totalWords,
    avgWords,
    rootCount: roots.length,
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
