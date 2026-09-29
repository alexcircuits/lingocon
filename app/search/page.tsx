import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { getSiteUrl } from "@/lib/seo"
import { SearchResults } from "./search-results"

export const metadata: Metadata = {
  title: "Search Conlangs — Find Constructed Languages, Dictionaries & Grammar",
  description: "Search thousands of constructed language entries on LingoCon. Find conlangs by name, browse dictionary words, grammar pages, and language scripts created by the community.",
  keywords: ["search conlang", "find constructed language", "conlang search", "conlang dictionary search", "LingoCon search"],
  alternates: {
    canonical: `${getSiteUrl()}/search`,
  },
}

export default async function SearchPage() {
  const [tErrors, tCommon] = await Promise.all([getTranslations("errors"), getTranslations("common")])
  return (
    <div className="min-h-screen bg-background pb-20">
      <Suspense>
        <SearchResults labels={{ failed: tErrors("somethingWrong"), retry: tCommon("tryAgain") }} />
      </Suspense>
    </div>
  )
}

