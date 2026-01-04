"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Trash2, Edit, Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface BulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  actions?: {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: "default" | "destructive" | "outline"
  }[]
  className?: string
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  actions = [],
  className,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        "sticky top-14 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="h-7 px-3">
            {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || "outline"}
              size="sm"
              onClick={action.onClick}
              className="h-7 gap-1.5"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

