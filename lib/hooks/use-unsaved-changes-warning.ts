"use client"

import { useEffect } from "react"

/**
 * While `isDirty`, closing or reloading the tab (or a full-page navigation) asks the
 * user to confirm instead of silently dropping the unsaved draft.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Still required by some browsers to show the prompt.
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [isDirty])
}
