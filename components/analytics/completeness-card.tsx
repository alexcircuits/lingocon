"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface CompletenessCardProps {
  stats: {
    counts: {
      scriptSymbols: number
      grammarPages: number
      dictionaryEntries: number
      paradigms: number
    }
    goals: {
      scriptSymbols: number
      grammarPages: number
      dictionaryEntries: number
      paradigms: number
    }
    progress: {
      scriptSymbols: number
      grammarPages: number
      dictionaryEntries: number
      paradigms: number
    }
    overall: number
  } | null
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className="h-full bg-primary transition-all duration-500 ease-in-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function CompletenessCard({ stats }: CompletenessCardProps) {
  if (!stats) return null

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Language Completeness</CardTitle>
        <CardDescription>Documentation progress against goals</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-center py-4">
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-8 border-secondary bg-transparent">
             <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                className="text-primary"
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * stats.overall) / 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
              />
            </svg>
            <div className="text-center">
              <span className="text-3xl font-bold">{stats.overall}%</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Dictionary ({stats.counts.dictionaryEntries}/{stats.goals.dictionaryEntries})</span>
              <span className="font-medium">{stats.progress.dictionaryEntries}%</span>
            </div>
            <ProgressBar value={stats.progress.dictionaryEntries} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Grammar ({stats.counts.grammarPages}/{stats.goals.grammarPages})</span>
              <span className="font-medium">{stats.progress.grammarPages}%</span>
            </div>
            <ProgressBar value={stats.progress.grammarPages} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Script ({stats.counts.scriptSymbols}/{stats.goals.scriptSymbols})</span>
              <span className="font-medium">{stats.progress.scriptSymbols}%</span>
            </div>
            <ProgressBar value={stats.progress.scriptSymbols} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Paradigms ({stats.counts.paradigms}/{stats.goals.paradigms})</span>
              <span className="font-medium">{stats.progress.paradigms}%</span>
            </div>
            <ProgressBar value={stats.progress.paradigms} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

