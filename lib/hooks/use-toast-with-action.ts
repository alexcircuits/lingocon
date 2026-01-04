"use client"

import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface ToastAction {
  label: string
  onClick: () => void
}

export function useToastWithAction() {
  const router = useRouter()

  const success = (
    message: string,
    options?: {
      action?: ToastAction
      undo?: () => void
      viewLink?: string
      duration?: number
    }
  ) => {
    const { action, undo, viewLink, duration = 4000 } = options || {}

    return toast.success(message, {
      duration,
      action: action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : viewLink
        ? {
            label: "View",
            onClick: () => router.push(viewLink),
          }
        : undefined,
      cancel: undo
        ? {
            label: "Undo",
            onClick: undo,
          }
        : undefined,
    })
  }

  const error = (
    message: string,
    options?: {
      retry?: () => void
      duration?: number
    }
  ) => {
    const { retry, duration = 5000 } = options || {}

    return toast.error(message, {
      duration,
      action: retry
        ? {
            label: "Retry",
            onClick: retry,
          }
        : undefined,
    })
  }

  return { success, error }
}

