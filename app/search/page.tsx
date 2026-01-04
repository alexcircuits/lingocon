import { Suspense } from "react"
import { SearchResults } from "./search-results"

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Suspense>
        <SearchResults />
      </Suspense>
    </div>
  )
}

