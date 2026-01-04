"use client"

import React, { useState } from "react"
import { toast } from "sonner"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)

  const copy = async (text: string, options?: { message?: string; duration?: number }) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(options?.message || "Copied to clipboard", {
        duration: options?.duration || 2000,
      })
      setTimeout(() => setCopied(false), 2000)
      return true
    } catch (err) {
      toast.error("Failed to copy to clipboard")
      return false
    }
  }

  return { copy, copied }
}

interface CopyButtonProps {
  text: string
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function CopyButton({
  text,
  message,
  className,
  size = "sm",
}: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard()

  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-9 w-9",
  }

  return (
    <button
      onClick={() => copy(text, { message })}
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors",
        sizeClasses[size],
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

