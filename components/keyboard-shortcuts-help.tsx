"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Keyboard } from "lucide-react"

interface Shortcut {
  keys: string[]
  description: string
  category?: string
}

interface KeyboardShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortcuts?: Shortcut[]
}

const defaultShortcuts: Shortcut[] = [
  {
    category: "Navigation",
    keys: ["⌘", "K"],
    description: "Open search",
  },
  {
    category: "Navigation",
    keys: ["⌘", "B"],
    description: "Go back",
  },
  {
    category: "Dictionary",
    keys: ["⌘", "N"],
    description: "New entry",
  },
  {
    category: "Dictionary",
    keys: ["⌘", "S"],
    description: "Save entry",
  },
  {
    category: "General",
    keys: ["Esc"],
    description: "Close dialog",
  },
  {
    category: "General",
    keys: ["⌘", "/"],
    description: "Show keyboard shortcuts",
  },
]

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
  shortcuts = defaultShortcuts,
}: KeyboardShortcutsHelpProps) {
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || "General"
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(shortcut)
    return acc
  }, {} as Record<string, Shortcut[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and work faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {items.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <Badge
                          key={keyIndex}
                          variant="outline"
                          className="font-mono text-xs px-2 py-1 bg-muted/50"
                        >
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

