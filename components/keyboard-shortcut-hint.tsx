"use client"

import { Badge } from "@/components/ui/badge"
import { Keyboard } from "lucide-react"
import { cn } from "@/lib/utils"

interface KeyboardShortcutHintProps {
  keys: string[]
  className?: string
  variant?: "default" | "outline" | "secondary"
  size?: "sm" | "md"
}

export function KeyboardShortcutHint({
  keys,
  className,
  variant = "outline",
  size = "sm",
}: KeyboardShortcutHintProps) {
  const sizeClasses = {
    sm: "h-5 px-1.5 text-[10px]",
    md: "h-6 px-2 text-xs",
  }

  return (
    <Badge
      variant={variant}
      className={cn(
        "font-mono gap-1 items-center",
        sizeClasses[size],
        className
      )}
    >
      {keys.map((key, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground">+</span>}
          <kbd className="px-1 py-0.5 bg-background/50 rounded text-[0.7em] font-mono">
            {key}
          </kbd>
        </span>
      ))}
    </Badge>
  )
}

