import type { Metadata } from "next"
import { Suspense } from "react"
import { SearchResults } from "./search-results"

export const metadata: Metadata = {
  title: "Search",
  description: "Search for constructed languages, dictionary entries, and grammar documentation on LingoCon.",
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Suspense>
        <SearchResults />
      </Suspense>
    </div>
  )
}

