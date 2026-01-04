"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface ChecklistItem {
  id: string
  label: string
  href?: string
  description?: string
}

interface GettingStartedChecklistProps {
  languageId: string
  languageSlug: string
  items: ChecklistItem[]
  completedItems?: string[]
  onItemComplete?: (itemId: string) => void
}

export function GettingStartedChecklist({
  languageId,
  languageSlug,
  items,
  completedItems = [],
  onItemComplete,
}: GettingStartedChecklistProps) {
  const [dismissed, setDismissed] = useState(false)
  const storageKey = `checklist-${languageId}-dismissed`

  // Load dismissed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored === "true") {
      setDismissed(true)
    }
  }, [storageKey])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(storageKey, "true")
  }

  if (dismissed) return null

  const allCompleted = items.every((item) => completedItems.includes(item.id))
  const completedCount = items.filter((item) => completedItems.includes(item.id)).length
  const progress = (completedCount / items.length) * 100

  const defaultItems: ChecklistItem[] = [
    {
      id: "name",
      label: "Set language name and description",
      href: `/studio/lang/${languageSlug}`,
      description: "Give your language a name and brief description",
    },
    {
      id: "alphabet",
      label: "Add script symbols",
      href: `/studio/lang/${languageSlug}/alphabet`,
      description: "Define your writing system",
    },
    {
      id: "dictionary",
      label: "Add dictionary entries",
      href: `/studio/lang/${languageSlug}/dictionary`,
      description: "Start building your vocabulary",
    },
    {
      id: "grammar",
      label: "Create grammar pages",
      href: `/studio/lang/${languageSlug}/grammar`,
      description: "Document your language's structure",
    },
    {
      id: "visibility",
      label: "Configure visibility settings",
      href: `/studio/lang/${languageSlug}/settings`,
      description: "Make your language public or private",
    },
  ]

  const checklistItems = items.length > 0 ? items : defaultItems

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Getting Started</CardTitle>
              <CardDescription>
                Complete these steps to get the most out of LingoCon&apos;s features.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {checklistItems.map((item) => {
            const isCompleted = completedItems.includes(item.id)
            return (
              <li key={item.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={cn(
                        "font-medium block hover:text-primary transition-colors",
                        isCompleted && "text-muted-foreground line-through"
                      )}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "font-medium block",
                        isCompleted && "text-muted-foreground line-through"
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {allCompleted && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              🎉 Great job! You&apos;ve completed the getting started checklist.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

