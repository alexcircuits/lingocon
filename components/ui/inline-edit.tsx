"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Check, X, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineEditProps {
  value: string
  /** Throw (or reject) to keep the editor open with the error shown — the input is never lost. */
  onSave: (value: string) => Promise<void> | void
  onCancel?: () => void
  placeholder?: string
  className?: string
  maxLength?: number
  validate?: (value: string) => string | null
  displayComponent?: React.ReactNode
  disabled?: boolean
  /** Field name for screen readers ("Description"); used for the input and the edit button. */
  label?: string
  /**
   * Multi-paragraph text: renders an auto-growing textarea where Enter inserts a newline and
   * Ctrl/Cmd+Enter saves, and preserves line breaks when displayed (GitHub #63).
   */
  multiline?: boolean
}

export function InlineEdit({
  value,
  onSave,
  onCancel,
  placeholder,
  className,
  maxLength,
  validate,
  displayComponent,
  disabled = false,
  label,
  multiline = false,
}: InlineEditProps) {
  const t = useTranslations("common")
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const displayRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isEditing) return
    const field = multiline ? textareaRef.current : inputRef.current
    field?.focus()
    field?.select()
  }, [isEditing, multiline])

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const stopEditing = () => {
    setIsEditing(false)
    // Return focus to the control that opened the editor.
    requestAnimationFrame(() => displayRef.current?.focus())
  }

  const handleStartEdit = () => {
    if (disabled) return
    setEditValue(value)
    setError(null)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value)
    setError(null)
    stopEditing()
    onCancel?.()
  }

  const handleSave = async () => {
    const trimmedValue = editValue.trim()

    if (validate) {
      const validationError = validate(trimmedValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    if (trimmedValue === value) {
      stopEditing()
      return
    }

    setIsSaving(true)
    try {
      await onSave(trimmedValue)
      setError(null)
      stopEditing()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      handleCancel()
    } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  if (isEditing) {
    const fieldClass = cn(error && "border-destructive focus-visible:ring-destructive")
    const onChange = (next: string) => {
      setEditValue(next)
      setError(null)
    }
    return (
      <div className={cn("flex gap-2", multiline ? "items-start" : "items-center", className)}>
        <div className="flex-1">
          {multiline ? (
            <Textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={isSaving}
              aria-label={label}
              aria-invalid={!!error}
              rows={Math.min(12, Math.max(4, editValue.split("\n").length + 1))}
              className={cn("resize-y", fieldClass)}
            />
          ) : (
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={maxLength}
              disabled={isSaving}
              aria-label={label}
              aria-invalid={!!error}
              className={cn("h-9 sm:h-8", fieldClass)}
            />
          )}
          {error && (
            <p className="text-xs text-destructive mt-1" role="alert">{error}</p>
          )}
          {maxLength && (
            <p className="text-xs text-muted-foreground mt-1">
              {editValue.length}/{maxLength}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            aria-label={t("save")}
            className="h-9 w-9 sm:h-8 sm:w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            aria-label={t("cancel")}
            className="h-9 w-9 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    )
  }

  const display = displayComponent || (
    <span className={cn("flex-1 text-foreground", multiline && "whitespace-pre-line", !value && "text-muted-foreground")}>
      {value || placeholder}
    </span>
  )

  if (disabled) {
    return <div className={cn("group flex items-center gap-2", className)}>{display}</div>
  }

  return (
    <button
      ref={displayRef}
      type="button"
      onClick={handleStartEdit}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      {/* Accessible name: "Edit Description: <current value>" — the value stays audible. */}
      <span className="sr-only">{label ? `${t("edit")} ${label}: ` : `${t("edit")}: `}</span>
      {display}
      <Pencil className="hover-reveal h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}
