"use client"

import { useEffect } from "react"

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  handler: (e: KeyboardEvent) => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape to close dialogs even when in inputs
        if (e.key === "Escape") {
          // Continue to check shortcuts
        } else {
          return
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey === undefined || shortcut.ctrlKey === (e.ctrlKey || e.metaKey)
        const metaMatch = shortcut.metaKey === undefined || shortcut.metaKey === e.metaKey
        const shiftMatch = shortcut.shiftKey === undefined || shortcut.shiftKey === e.shiftKey
        const altMatch = shortcut.altKey === undefined || shortcut.altKey === e.altKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault()
          shortcut.handler(e)
          break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts])
}

// Common keyboard shortcuts for the app
export const commonShortcuts = {
  search: { key: "k", metaKey: true, description: "Open search" },
  newEntry: { key: "n", metaKey: true, description: "New entry" },
  save: { key: "s", metaKey: true, description: "Save" },
  escape: { key: "Escape", description: "Close dialog" },
  back: { key: "b", metaKey: true, description: "Go back" },
}

