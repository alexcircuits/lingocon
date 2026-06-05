"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ValidationWarning {
  type: "undefined_symbol" | "missing_entry" | "unused_symbol" | "missing_paradigm"
  message: string
  severity: "warning" | "info"
}

interface ValidationWarningsProps {
  warnings: ValidationWarning[]
}

export function ValidationWarnings({ warnings }: ValidationWarningsProps) {
  const [open, setOpen] = useState(false)

  if (warnings.length === 0) {
    return null
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-800 dark:text-yellow-200">
              {warnings.length} Validation Warning{warnings.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse warnings" : "Expand warnings"}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
        </CardContent>
      )}
    </Card>
  )
}
