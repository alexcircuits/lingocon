"use client"

import { useState } from "react"
import { LanguageFamilyBuilder } from "./language-family-builder"
import { FamilyTimeline } from "./family-timeline"
import { GitFork, Clock } from "lucide-react"

interface FamilyViewSwitcherProps {
  initialLanguages: any[]
  currentUserId: string
}

export function FamilyViewSwitcher({ initialLanguages, currentUserId }: FamilyViewSwitcherProps) {
  const [view, setView] = useState<"builder" | "timeline">("builder")

  return (
    <>
      {/* View toggle — positioned top-center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <div className="flex bg-card/80 backdrop-blur-md border border-border/50 rounded-lg p-0.5 shadow-lg">
          <button
            type="button"
            onClick={() => setView("builder")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              view === "builder"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitFork className="h-3.5 w-3.5" />
            Builder
          </button>
          <button
            type="button"
            onClick={() => setView("timeline")}
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
        <LanguageFamilyBuilder initialLanguages={initialLanguages} currentUserId={currentUserId} />
      ) : (
        <FamilyTimeline languages={initialLanguages} currentUserId={currentUserId} />
      )}
    </>
  )
}
