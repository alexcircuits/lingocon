"use client"

import { useEffect, useState } from "react"
import { getParadigmsForLanguage } from "@/app/actions/paradigm"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface ParadigmSelectorProps {
  languageId: string
  value?: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
}

export function ParadigmSelector({
  languageId,
  value,
  onValueChange,
  disabled = false,
}: ParadigmSelectorProps) {
  const [paradigms, setParadigms] = useState<Array<{ id: string; name: string; notes: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchParadigms() {
      setLoading(true)
      setError(null)
      const result = await getParadigmsForLanguage(languageId)
      if (result.error) {
        setError(result.error ?? null)
      } else if (result.data) {
        setParadigms(result.data)
      }
      setLoading(false)
    }

    if (languageId) {
      fetchParadigms()
    }
  }, [languageId])

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Paradigm</Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading paradigms...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>Paradigm</Label>
        <div className="text-sm text-destructive">{error}</div>
      </div>
    )
  }

  const NONE_VALUE = "__none__"

  return (
    <div className="space-y-2">
      <Label htmlFor="paradigm">Paradigm</Label>
      <Select
        value={value || NONE_VALUE}
        onValueChange={(val) => {
          if (val === NONE_VALUE) {
            onValueChange(null)
          } else {
            onValueChange(val)
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger id="paradigm">
          <SelectValue placeholder="Select a paradigm (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>None</SelectItem>
          {paradigms.map((paradigm) => (
            <SelectItem key={paradigm.id} value={paradigm.id}>
              {paradigm.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {paradigms.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No paradigms available. Create one in the Paradigms section.
        </p>
      )}
    </div>
  )
}

