"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { useEffect, useState } from "react"

interface DictionarySearchProps {
  onSearch: (query: string) => void
  defaultValue?: string
}

export function DictionarySearch({ onSearch, defaultValue = "" }: DictionarySearchProps) {
  const [value, setValue] = useState(defaultValue)
  const debouncedValue = useDebounce(value, 300)

  useEffect(() => {
    onSearch(debouncedValue)
  }, [debouncedValue, onSearch])

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search by lemma, gloss, IPA, or part of speech..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}

