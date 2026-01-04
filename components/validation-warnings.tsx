"use client"

import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ValidationWarning {
  type: "undefined_symbol" | "missing_entry" | "unused_symbol" | "missing_paradigm"
  message: string
  severity: "warning" | "info"
}

interface ValidationWarningsProps {
  warnings: ValidationWarning[]
}

export function ValidationWarnings({ warnings }: ValidationWarningsProps) {
  if (warnings.length === 0) {
    return null
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          Validation Warnings
        </CardTitle>
        <CardDescription className="text-xs">
          These are suggestions to help improve consistency. They don&apos;t prevent saving.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {warnings.map((warning, idx) => (
            <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
              • {warning.message}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

