"use client"

import Link from "next/link"
import { BookCard } from "@/components/landing/book-card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import type { Language, User as UserType } from "@prisma/client"

interface FeaturedLanguagesProps {
  languages: Array<
    Language & {
      owner: Pick<UserType, "id" | "name" | "image">
      _count: {
        scriptSymbols: number
        grammarPages: number
        dictionaryEntries: number
        favorites?: number
      }
      flagUrl?: string | null
    }
  >
}

export function FeaturedLanguages({ languages }: FeaturedLanguagesProps) {
  if (languages.length === 0) {
    return null
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-12 px-4 md:px-0">
      {languages.map((language) => (
        <BookCard key={language.id} language={language} />
      ))}

      <div className="md:col-span-2 lg:col-span-3 flex justify-center mt-12">
        <Link href="/browse">
          <Button variant="ghost" size="lg" className="px-8 font-serif italic text-lg hover:bg-transparent hover:text-primary transition-all group">
            Browse the full library
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
