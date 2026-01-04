"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FeatureHighlightProps {
  id: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: "default" | "new" | "tip"
  position?: "top" | "bottom" | "left" | "right"
  dismissible?: boolean
  className?: string
}

export function FeatureHighlight({
  id,
  title,
  description,
  action,
  variant = "default",
  dismissible = true,
  className,
}: FeatureHighlightProps) {
  const [dismissed, setDismissed] = useState(false)
  const storageKey = `feature-${id}-dismissed`

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

  const variantStyles = {
    default: "border-primary/20 bg-primary/5",
    new: "border-emerald-500/20 bg-emerald-500/5",
    tip: "border-amber-500/20 bg-amber-500/5",
  }

  return (
    <Card className={cn("border-dashed relative", variantStyles[variant], className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{title}</h4>
              {variant === "new" && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  New
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">{description}</p>
            {action && (
              <Button
                size="sm"
                variant="outline"
                onClick={action.onClick}
                className="h-7 text-xs"
              >
                {action.label}
              </Button>
            )}
          </div>
          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-6 w-6 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

