"use client"

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc" | null

interface TableSortProps {
  label: string
  currentSort?: {
    field: string
    direction: SortDirection
  }
  field: string
  onSort: (field: string, direction: SortDirection) => void
  className?: string
}

export function TableSort({
  label,
  currentSort,
  field,
  onSort,
  className,
}: TableSortProps) {
  const isActive = currentSort?.field === field
  const direction = isActive ? currentSort?.direction : null

  const handleClick = () => {
    if (!isActive || direction === null) {
      onSort(field, "asc")
    } else if (direction === "asc") {
      onSort(field, "desc")
    } else {
      onSort(field, null)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn(
        "h-8 gap-2 hover:bg-muted/50",
        isActive && "bg-muted",
        className
      )}
    >
      {label}
      {direction === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : direction === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </Button>
  )
}

