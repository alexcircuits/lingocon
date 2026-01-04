"use client"

import { CheckCircle2, Loader2, AlertCircle, Save } from "lucide-react"
import { cn } from "@/lib/utils"

type StatusType = "idle" | "saving" | "saved" | "error" | "unsaved"

interface StatusIndicatorProps {
  status: StatusType
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

const statusConfig: Record<
  StatusType,
  {
    icon: typeof Save
    color: string
    bgColor: string
    label: string
    animate?: boolean
  }
> = {
  idle: {
    icon: Save,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    label: "Ready",
  },
  saving: {
    icon: Loader2,
    color: "text-primary",
    bgColor: "bg-primary/10",
    label: "Saving...",
    animate: true,
  },
  saved: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    label: "Saved",
  },
  error: {
    icon: AlertCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    label: "Error",
  },
  unsaved: {
    icon: Save,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    label: "Unsaved changes",
  },
}

export function StatusIndicator({
  status,
  message,
  className,
  size = "sm",
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
        config.bgColor,
        className
      )}
    >
      <Icon
        className={cn(
          sizeClasses[size],
          config.color,
          config.animate && "animate-spin"
        )}
      />
      {(message || config.label) && (
        <span className={cn(textSizeClasses[size], config.color)}>
          {message || config.label}
        </span>
      )}
    </div>
  )
}

