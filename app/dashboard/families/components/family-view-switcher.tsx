"use client"

import { useState, useCallback } from "react"
import { LanguageFamilyBuilder } from "./language-family-builder"
import { FamilyTimeline } from "./family-timeline"
import { GitFork, Clock } from "lucide-react"

interface FamilyLanguageData {
  id: string
  name: string
  slug: string
  parentLanguageId: string | null
  externalAncestry: string | null
  ownerId: string
  createdAt?: string | Date
  owner?: { id: string; name: string | null; image: string | null }
  _count: { dictionaryEntries: number }
}

interface FamilyViewSwitcherProps {
  initialLanguages: FamilyLanguageData[]
  currentUserId: string
}

export function FamilyViewSwitcher({ initialLanguages, currentUserId }: FamilyViewSwitcherProps) {
  const [view, setView] = useState<"builder" | "timeline">("builder")
  const [pendingCount, setPendingCount] = useState(0)

  const handleViewChange = useCallback((newView: "builder" | "timeline") => {
    if (newView === view) return
    if (pendingCount > 0) {
      const confirmed = window.confirm(
        `You have ${pendingCount} unsaved change${pendingCount !== 1 ? "s" : ""}. Switching views will discard them. Continue?`
      )
      if (!confirmed) return
    }
    setView(newView)
  }, [view, pendingCount])

  return (
    <>
      {/* View toggle — positioned top-center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <div className="flex bg-card/80 backdrop-blur-md border border-border/50 rounded-lg p-0.5 shadow-lg">
          <button
            type="button"
            onClick={() => handleViewChange("builder")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "builder"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitFork className="h-3.5 w-3.5" />
            Builder
            {view === "builder" && pendingCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "timeline"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Timeline
          </button>
        </div>
      </div>

      {/* Views */}
      {view === "builder" ? (
        <LanguageFamilyBuilder
          initialLanguages={initialLanguages}
          currentUserId={currentUserId}
          onPendingChangesChange={setPendingCount}
        />
      ) : (
        <FamilyTimeline languages={initialLanguages} currentUserId={currentUserId} />
      )}
    </>
  )
}
