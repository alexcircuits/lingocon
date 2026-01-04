"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, X, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineEditProps {
  value: string
  onSave: (value: string) => Promise<void> | void
  onCancel?: () => void
  placeholder?: string
  className?: string
  maxLength?: number
  validate?: (value: string) => string | null
  displayComponent?: React.ReactNode
  disabled?: boolean
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
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleStartEdit = () => {
    if (disabled) return
    setEditValue(value)
    setError(null)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value)
    setError(null)
    setIsEditing(false)
    onCancel?.()
  }

  const handleSave = async () => {
    const trimmedValue = editValue.trim()
    
    // Validation
    if (validate) {
      const validationError = validate(trimmedValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    if (trimmedValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(trimmedValue)
      setIsEditing(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={isSaving}
            className={cn(
              "h-8",
              error && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {error && (
            <p className="text-xs text-destructive mt-1">{error}</p>
          )}
          {maxLength && (
            <p className="text-xs text-muted-foreground mt-1">
              {editValue.length}/{maxLength}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2",
        !disabled && "cursor-pointer",
        className
      )}
      onClick={handleStartEdit}
    >
      {displayComponent || (
        <span className="flex-1 text-foreground">{value || placeholder}</span>
      )}
      {!disabled && (
        <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}

