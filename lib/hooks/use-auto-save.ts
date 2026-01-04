"use client"

import { useEffect, useRef, useState } from "react"
import { useDebounce } from "./use-debounce"

interface UseAutoSaveOptions<T> {
  data: T
  onSave: (data: T) => Promise<void> | void
  debounceMs?: number
  enabled?: boolean
  onError?: (error: Error) => void
}

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 1000,
  enabled = true,
  onError,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const debouncedData = useDebounce(data, debounceMs)
  const previousDataRef = useRef<T>(data)
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      previousDataRef.current = data
      return
    }

    if (!enabled) {
      setHasUnsavedChanges(false)
      return
    }

    // Check if data has changed
    const hasChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current)
    
    if (hasChanged) {
      setHasUnsavedChanges(true)
    }
  }, [data, enabled])

  useEffect(() => {
    if (!enabled || isInitialMount.current) return

    const hasChanged =
      JSON.stringify(debouncedData) !== JSON.stringify(previousDataRef.current)

    if (hasChanged && hasUnsavedChanges) {
      setStatus("saving")
      
      Promise.resolve(onSave(debouncedData))
        .then(() => {
          setStatus("saved")
          setHasUnsavedChanges(false)
          previousDataRef.current = debouncedData
          
          // Reset to idle after 2 seconds
          setTimeout(() => {
            setStatus("idle")
          }, 2000)
        })
        .catch((error) => {
          setStatus("error")
          onError?.(error)
          
          // Reset to idle after 3 seconds
          setTimeout(() => {
            setStatus("idle")
          }, 3000)
        })
    }
  }, [debouncedData, onSave, enabled, hasUnsavedChanges])

  return {
    status,
    hasUnsavedChanges,
  }
}

