"use client"

import { useState, KeyboardEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"

interface TagsInputProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  maxTags?: number
}

export function TagsInput({
  value,
  onChange,
  placeholder = "Add tags...",
  maxTags = 10,
}: TagsInputProps) {
  const [inputValue, setInputValue] = useState("")

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      const newTag = inputValue.trim()

      if (newTag && !value.includes(newTag) && value.length < maxTags) {
        onChange([...value, newTag])
        setInputValue("")
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
          {tag}
          <div
            role="button"
            tabIndex={0}
            onClick={() => removeTag(tag)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                removeTag(tag)
              }
            }}
            className="rounded-full flex items-center justify-center p-0.5 hover:bg-muted-foreground/20 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove {tag}</span>
          </div>
        </Badge>
      ))}
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        disabled={value.length >= maxTags}
        className="flex-1 min-w-[120px] bg-transparent border-0 h-6 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none -mb-1 -mt-1"
      />
    </div>
  )
}
