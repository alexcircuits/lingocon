"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ValidationWarning {
  type: "undefined_symbol" | "missing_entry" | "unused_symbol" | "missing_paradigm"
  message: string
  severity: "warning" | "info"
}

interface ValidationWarningsProps {
  warnings: ValidationWarning[]
  /** Total number of warnings when `warnings` is a truncated list. */
  total?: number
  /**
   * Optional stable key (e.g. language id) used to persist dismissal across
   * sessions in localStorage. When omitted, dismissal is per-tab only.
   */
  scopeKey?: string
}

const STORAGE_PREFIX = "validation-warnings-dismissed:"

export function ValidationWarnings({ warnings, scopeKey, total }: ValidationWarningsProps) {
  const count = total ?? warnings.length
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // Track when the persisted dismissal state has been loaded — we render
  // nothing during this initial paint to avoid a flash of the warnings card
  // when the user has previously dismissed it.
  const [hydrated, setHydrated] = useState(false)

  // Hydrate dismissal state from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (scopeKey) {
      try {
        setDismissed(window.localStorage.getItem(STORAGE_PREFIX + scopeKey) === "1")
      } catch {
        // Storage may be blocked (private browsing, quota, etc.) — fall back
        // to a non-persisted dismissal for the current session only.
      }
    }
    setHydrated(true)
  }, [scopeKey])

  const persistDismissed = (value: boolean) => {
    setDismissed(value)
    if (typeof window === "undefined" || !scopeKey) return
    try {
      if (value) {
        window.localStorage.setItem(STORAGE_PREFIX + scopeKey, "1")
      } else {
        window.localStorage.removeItem(STORAGE_PREFIX + scopeKey)
      }
    } catch {
      // Ignore — dismissal still applies for the current session.
    }
  }

  if (warnings.length === 0) return null
  if (!hydrated) return null

  if (dismissed) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => persistDismissed(false)}
          className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs text-yellow-800 hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200 dark:hover:bg-yellow-900"
        >
          <AlertTriangle className="h-3 w-3" />
          {count} warning{count !== 1 ? "s" : ""} hidden — show
        </button>
      </div>
    )
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-left hover:opacity-80"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
            )}
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-800 dark:text-yellow-200">
              {count} Validation Warning{count !== 1 ? "s" : ""}
            </span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900"
            onClick={() => persistDismissed(true)}
            aria-label="Hide validation warnings"
            title="Hide validation warnings"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pb-3 pt-0">
          <p className="mb-2 text-xs text-yellow-700 dark:text-yellow-400">
            Suggestions to improve consistency — they don&apos;t prevent saving.
          </p>
          <ul className="space-y-1.5">
            {warnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                • {warning.message}
              </li>
            ))}
          </ul>
          {count > warnings.length && (
            <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-400">
              …and {count - warnings.length} more
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
