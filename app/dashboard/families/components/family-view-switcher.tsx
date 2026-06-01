"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { FamilyTimeline } from "./family-timeline"
import { GitFork, Clock, Network, Info, FolderTree, Globe } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface FamilyLanguageData {
  id: string
  name: string
  slug: string
  parentLanguageId: string | null
  externalAncestry: string | null
  familyId?: string | null
  family?: { id: string; name: string } | null
  ownerId: string
  createdAt?: string | Date
  owner?: { id: string; name: string | null; image: string | null }
  _count: { dictionaryEntries: number }
}

interface FamilyViewSwitcherProps {
  initialLanguages: FamilyLanguageData[]
  currentUserId: string
}

// Lazy-load ReactFlow builder — it's ~400KB and blocks the main thread on init.
// SSR is disabled because ReactFlow requires the DOM.
const LanguageFamilyBuilder = dynamic(
  () =>
    import("./language-family-builder").then(m => ({
      default: m.LanguageFamilyBuilder,
    })),
  {
    ssr: false,
    loading: () => <BuilderSkeleton />,
  }
)

function BuilderSkeleton() {
  return (
    <div className="w-full h-full bg-muted/10 flex flex-col items-center justify-center gap-6 p-8">
      {/* Fake tree structure */}
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
        {/* Root row */}
        <div className="flex justify-center gap-6">
          <Skeleton className="h-[88px] w-[200px] rounded-xl" />
        </div>
        {/* Connector lines */}
        <div className="flex gap-10 items-start">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-8 w-0.5" />
            <Skeleton className="h-[88px] w-[200px] rounded-xl" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-8 w-0.5" />
            <Skeleton className="h-[88px] w-[200px] rounded-xl" />
          </div>
        </div>
        {/* Second level */}
        <div className="flex justify-start gap-6 self-start ml-12">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-8 w-0.5" />
            <Skeleton className="h-[88px] w-[200px] rounded-xl" />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4 animate-pulse">
        Loading family tree…
      </p>
    </div>
  )
}

type View = "builder" | "timeline"

export function FamilyViewSwitcher({ initialLanguages, currentUserId }: FamilyViewSwitcherProps) {
  const [view, setView] = useState<View>("builder")
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingView, setPendingView] = useState<View | null>(null)

  const handleViewChange = useCallback(
    (newView: View) => {
      if (newView === view) return
      if (pendingCount > 0) {
        setPendingView(newView)
        return
      }
      setView(newView)
    },
    [view, pendingCount]
  )

  const confirmSwitch = useCallback(() => {
    if (pendingView) setView(pendingView)
    setPendingView(null)
  }, [pendingView])

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:text-foreground"
    }`

  return (
    <div className="flex flex-col h-full">
      {/* Header bar — part of the normal document flow, never floats over the canvas */}
      <div className="shrink-0 h-11 border-b border-border/50 bg-card/60 backdrop-blur-sm flex items-center justify-between px-3 sm:px-4 gap-3">
        {/* Left: tree stats + explainer */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <Network className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">
            {initialLanguages.length} language{initialLanguages.length !== 1 ? "s" : ""}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center text-muted-foreground/70 hover:text-foreground transition-colors"
                aria-label="How families work"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 text-sm font-display">
              <h4 className="font-bold tracking-tight mb-2">How families work</h4>
              <ul className="space-y-2 text-muted-foreground text-[13px] leading-relaxed">
                <li className="flex gap-2">
                  <GitFork className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Lineage</strong> — the lines you draw here mean
                    “descends&nbsp;from”. Connect a parent to a daughter language to record how it evolved.
                  </span>
                </li>
                <li className="flex gap-2">
                  <FolderTree className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-foreground">Families</strong> — named groups (like
                    Proto-Indo-European) you assign in <em>Manage</em>. They color the map and hold shared
                    proto-vocabulary.
                  </span>
                </li>
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        {/* Centre: view toggle */}
        <div className="flex bg-muted/50 border border-border/50 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => handleViewChange("builder")}
            className={tabClass(view === "builder")}
          >
            <GitFork className="h-3.5 w-3.5" />
            Builder
            {view === "builder" && pendingCount > 0 && (
              <span className="ml-0.5 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("timeline")}
            className={tabClass(view === "timeline")}
          >
            <Clock className="h-3.5 w-3.5" />
            Timeline
          </button>
        </div>

        {/* Right: cross-links to the rest of the families workspace */}
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link href="/dashboard/families/manage">
              <FolderTree className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Manage</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link href="/families">
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Public map</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Canvas — fills the remaining height exactly */}
      <div className="flex-1 overflow-hidden relative">
        {view === "builder" ? (
          <LanguageFamilyBuilder
            initialLanguages={initialLanguages}
            currentUserId={currentUserId}
            onPendingChangesChange={setPendingCount}
          />
        ) : (
          <FamilyTimeline languages={initialLanguages} currentUserId={currentUserId} />
        )}
      </div>

      <AlertDialog
        open={pendingView !== null}
        onOpenChange={(open) => {
          if (!open) setPendingView(null)
        }}
      >
        <AlertDialogContent className="font-display">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {pendingCount} unsaved change{pendingCount !== 1 ? "s" : ""} in the Builder.
              Switching views will discard {pendingCount !== 1 ? "them" : "it"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>
              Discard &amp; switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
