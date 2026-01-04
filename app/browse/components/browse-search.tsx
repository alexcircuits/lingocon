"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export function BrowseSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""
  
  const [value, setValue] = useState(initialQuery)
  const debouncedValue = useDebounce(value, 300)

  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    if (debouncedValue) {
      params.set("q", debouncedValue)
    } else {
      params.delete("q")
    }
    // Reset page when searching
    if (debouncedValue !== initialQuery) {
      params.delete("page")
    }
    
    router.push(`/browse?${params.toString()}`)
  }, [debouncedValue, router, searchParams, initialQuery])

  return (
    <div className="relative w-full md:w-80">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Filter languages..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}

