"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HelpCircle, Keyboard } from "lucide-react"
import { cn } from "@/lib/utils"

interface ContextualHelpProps {
  content: string
  shortcut?: string
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  variant?: "icon" | "text"
}

export function ContextualHelp({
  content,
  shortcut,
  className,
  side = "top",
  variant = "icon",
}: ContextualHelpProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {variant === "icon" ? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors",
                className
              )}
            >
              <HelpCircle className="h-4 w-4" />
              <span className="sr-only">Help</span>
            </button>
          ) : (
            <span className={cn("text-muted-foreground hover:text-foreground cursor-help", className)}>
              <HelpCircle className="h-3.5 w-3.5 inline mr-1" />
              Help
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-sm">{content}</p>
          {shortcut && (
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
              <Keyboard className="h-3 w-3" />
              <span className="text-xs font-mono">{shortcut}</span>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

