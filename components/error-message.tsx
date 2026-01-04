"use client"

import { AlertCircle, X, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface ErrorMessageProps {
  title?: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  variant?: "default" | "destructive" | "warning"
}

export function ErrorMessage({
  title,
  message,
  onRetry,
  onDismiss,
  className,
  variant = "destructive",
}: ErrorMessageProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "warning":
        return "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      case "destructive":
        return "border-destructive/50 bg-destructive/10 text-destructive"
      default:
        return "border-border bg-muted text-foreground"
    }
  }

  return (
    <Alert className={cn(getVariantStyles(), className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{title || "Error"}</span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-2"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p>{message}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

