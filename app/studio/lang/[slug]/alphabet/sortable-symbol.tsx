"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, ArrowRight, GripVertical, MoreVertical, Pencil, Trash2 } from "lucide-react"
import type { ScriptSymbol } from "./alphabet-manager"

interface SortableSymbolProps {
  symbol: ScriptSymbol
  index: number
  totalCount: number
  isPending: boolean
  onEdit: (symbol: ScriptSymbol) => void
  onDelete: (id: string) => void
  onReorder: (id: string, direction: "up" | "down") => void
}

export function SortableSymbol({
  symbol,
  index,
  totalCount,
  isPending,
  onEdit,
  onDelete,
  onReorder,
}: SortableSymbolProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: symbol.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group hover:shadow-md transition-shadow",
        isDragging && "shadow-xl"
      )}
    >
      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px]">
        <button
          type="button"
          className="absolute top-2 left-2 hover-reveal flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-md text-muted-foreground touch-none cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="absolute top-2 right-2 hover-reveal"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(symbol)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onReorder(symbol.id, "up")}
                disabled={index === 0 || isPending}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Move Left
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onReorder(symbol.id, "down")}
                disabled={index === totalCount - 1 || isPending}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Move Right
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(symbol.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="text-2xl sm:text-4xl font-serif font-medium mb-2 flex flex-wrap items-center justify-center gap-1 max-w-full truncate">
          {symbol.capitalSymbol ? (
            <>
              <span className="font-custom-script">{symbol.capitalSymbol}</span>
              <span className="font-custom-script">{symbol.symbol}</span>
            </>
          ) : (
            <span className="font-custom-script">{symbol.symbol}</span>
          )}
          {/^\p{M}$/u.test(symbol.symbol) && (
            <span className="absolute text-muted-foreground/30 -ml-4 pointer-events-none">◌</span>
          )}
          {symbol.latin && symbol.latin !== symbol.symbol && (
            <>
              <span className="text-muted-foreground/30 mx-1">/</span>
              <span className="text-2xl text-muted-foreground">{symbol.latin}</span>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          {symbol.ipa && (
            <Badge variant="secondary" className="font-mono text-xs">
              /{symbol.ipa}/
            </Badge>
          )}
          {symbol.name && (
            <span className="text-xs text-muted-foreground">
              {symbol.name}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
