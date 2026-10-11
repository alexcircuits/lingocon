"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useDebounce } from "@/lib/hooks/use-debounce"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export function BrowseSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get("q") || ""

  const [value, setValue] = useState(urlQuery)
  // The last query this field put in the URL: when that navigation lands, the person may
  // have typed on, and their text must not be replaced by it.
  const [pushedQuery, setPushedQuery] = useState<string | null>(null)
  // Back/forward or a link changed the query: show it (adjusting state while rendering).
  const [shownUrlQuery, setShownUrlQuery] = useState(urlQuery)
  if (urlQuery !== shownUrlQuery) {
    setShownUrlQuery(urlQuery)
    // Our own navigation landed: done with it (a later back/forward to it is followed).
    if (urlQuery === pushedQuery) setPushedQuery(null)
    else setValue(urlQuery)
  }
  const debouncedValue = useDebounce(value, 300)

  useEffect(() => {
    // Navigate only for a settled query the URL does not hold yet. This used to push on every
    // load (an extra navigation and history entry per visit, racing other router updates) and
    // pushed a stale query back after back/forward.
    // (Also skip a query whose navigation is still in flight.)
    if (debouncedValue !== value || debouncedValue === urlQuery || debouncedValue === pushedQuery) return
    const params = new URLSearchParams(searchParams.toString())
    if (debouncedValue) {
      params.set("q", debouncedValue)
    } else {
      params.delete("q")
    }
    // A new query starts again on page one.
    params.delete("page")
    setPushedQuery(debouncedValue)
    router.push(`/browse?${params.toString()}`)
  }, [debouncedValue, value, urlQuery, pushedQuery, router, searchParams])

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
