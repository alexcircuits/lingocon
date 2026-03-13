"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ListChecks, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react"
import { SWADESH_LIST, SWADESH_CATEGORIES, matchSwadeshList } from "@/lib/data/swadesh-list"

interface SwadeshTrackerProps {
  glosses: string[]
}

export function SwadeshTracker({ glosses }: SwadeshTrackerProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { matched, percentage, total } = useMemo(
    () => matchSwadeshList(glosses),
    [glosses]
  )

  // Group by category for detail view
  const categoryStats = useMemo(() => {
    return SWADESH_CATEGORIES.map(cat => {
      const concepts = SWADESH_LIST.filter(c => c.category === cat)
      const matchedCount = concepts.filter(c => matched.has(c.id)).length
      return {
        category: cat,
        total: concepts.length,
        matched: matchedCount,
        percentage: Math.round((matchedCount / concepts.length) * 100),
        concepts,
      }
    })
  }, [matched])

  // Determine the color based on percentage
  const getColorClass = (pct: number) => {
    if (pct >= 80) return "text-green-500"
    if (pct >= 50) return "text-amber-500"
    if (pct >= 20) return "text-orange-500"
    return "text-muted-foreground"
  }

  const getBarColor = (pct: number) => {
    if (pct >= 80) return "bg-green-500"
    if (pct >= 50) return "bg-amber-500"
    if (pct >= 20) return "bg-orange-500"
    return "bg-muted-foreground"
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-blue-500" />
            Swadesh List
          </div>
          <Badge variant="outline" className={`text-xs ${getColorClass(percentage)}`}>
            {matched.size}/{total}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Basic vocabulary coverage</span>
            <span className={`font-medium ${getColorClass(percentage)}`}>{percentage}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-2 gap-1.5">
          {categoryStats.map(cat => (
            <button
              key={cat.category}
              onClick={() => {
                setSelectedCategory(
                  selectedCategory === cat.category ? null : cat.category
                )
                setExpanded(true)
              }}
              className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-md border transition-colors ${
                selectedCategory === cat.category
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <span className="truncate">{cat.category}</span>
              <span className={`font-mono ${getColorClass(cat.percentage)}`}>
                {cat.matched}/{cat.total}
              </span>
            </button>
          ))}
        </div>

        {/* Expand/Collapse */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Show missing words
            </>
          )}
        </Button>

        {/* Detailed concept list */}
        {expanded && (
          <ScrollArea className="h-[200px] rounded-md border">
            <div className="p-2 space-y-0.5">
              {(selectedCategory
                ? SWADESH_LIST.filter(c => c.category === selectedCategory)
                : SWADESH_LIST.filter(c => !matched.has(c.id))
              ).map(concept => {
                const isMatched = matched.has(concept.id)
                return (
                  <div
                    key={concept.id}
                    className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                      isMatched ? "text-muted-foreground" : ""
                    }`}
                  >
                    {isMatched ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={isMatched ? "line-through" : ""}>{concept.english}</span>
                    {!selectedCategory && (
                      <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0">
                        {concept.category}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
