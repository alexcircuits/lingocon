"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DictionarySearchProps {
  onSearch: (query: string, field?: string) => void
  defaultValue?: string
  defaultField?: string
}

export function DictionarySearch({
  onSearch,
  defaultValue = "",
  defaultField = "all"
}: DictionarySearchProps) {
  const [value, setValue] = useState(defaultValue)
  const [field, setField] = useState(defaultField)
  const debouncedValue = useDebounce(value, 300)

  // Trigger search when query (debounced) or field changes
  useEffect(() => {
    // Skip initial trigger if values haven't changed from default
    if (value === defaultValue && field === defaultField) return

    // If field is "all", we pass undefined to the backend to search all fields
    onSearch(debouncedValue, field === "all" ? undefined : field)
  }, [debouncedValue, field, onSearch, defaultValue, defaultField, value])

  const handleFieldChange = (newField: string) => {
    setField(newField)
    // No need to call onSearch here, the useEffect will trigger
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={field === "gloss" ? "Search meanings..." : "Search dictionary..."}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Fields</SelectItem>
          <SelectItem value="lemma">Word</SelectItem>
          <SelectItem value="gloss">Meaning</SelectItem>
          <SelectItem value="partOfSpeech">POS</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
