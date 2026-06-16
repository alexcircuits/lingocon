"use client"

import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown } from "lucide-react"

export function MoveControls({
  canUp, canDown, onMove, label,
}: {
  canUp: boolean
  canDown: boolean
  onMove: (dir: "up" | "down") => void
  label: string
}) {
  return (
    <div className="flex flex-col justify-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        disabled={!canUp}
        onClick={() => onMove("up")}
        aria-label={`Move ${label} up`}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        disabled={!canDown}
        onClick={() => onMove("down")}
        aria-label={`Move ${label} down`}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}
