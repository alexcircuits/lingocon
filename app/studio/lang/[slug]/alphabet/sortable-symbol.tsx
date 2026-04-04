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
import { ArrowLeft, ArrowRight, MoreVertical, Pencil, Trash2 } from "lucide-react"
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
        "relative group hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing",
        isDragging && "shadow-xl"
      )}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[140px]">
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
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

        <div className="text-4xl font-serif font-medium mb-2 flex items-center justify-center gap-1">
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
