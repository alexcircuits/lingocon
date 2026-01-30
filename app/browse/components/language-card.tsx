"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, BookOpen, Languages, ArrowRight } from "lucide-react"
import { FavoriteButton } from "@/components/favorite-button"
import { formatDate } from "@/lib/utils"
import type { Language, User as UserType } from "@prisma/client"
import { motion } from "motion/react"
import { LanguagePlaceholder } from "@/components/language-placeholder"

interface LanguageCardProps {
  language: Language & {
    owner: Pick<UserType, "id" | "name" | "image">
    _count: {
      scriptSymbols: number
      grammarPages: number
      dictionaryEntries: number
      favorites?: number
    }
    flagUrl?: string | null
  }
}

export function LanguageCard({ language }: LanguageCardProps) {
  const router = useRouter()

  const handleUserClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/users/${language.owner.id}`)
  }

  return (
    <Link href={`/lang/${language.slug}`}>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="h-full"
      >
        <Card className="h-full border-border/40 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group overflow-hidden relative">
          {/* Decorative gradient blob */}
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />

          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <LanguagePlaceholder
                  name={language.name}
                  flagUrl={language.flagUrl}
                  size="md"
                  variant="flag"
                />
                <div className="space-y-0.5">
                  <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1">
                    {language.name}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={handleUserClick}
                      className="hover:text-foreground transition-colors hover:underline"
                    >
                      {language.owner.name || "Anonymous"}
                    </button>
                    <span>•</span>
                    <span>{formatDate(language.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <FavoriteButton
                  languageId={language.id}
                  isFavorite={false}
                  favoriteCount={language._count.favorites ?? 0}
                  size="sm"
                />
              </div>
            </div>
            {language.description && (
              <CardDescription className="line-clamp-2 text-sm mt-3">
                {language.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0 relative z-10">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors">
                <Languages className="h-4 w-4 text-primary mb-1" />
                <span className="font-semibold text-sm">{language._count.scriptSymbols}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Symbols</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors">
                <BookOpen className="h-4 w-4 text-violet-500 mb-1" />
                <span className="font-semibold text-sm">{language._count.grammarPages}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Pages</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors">
                <FileText className="h-4 w-4 text-emerald-500 mb-1" />
                <span className="font-semibold text-sm">{language._count.dictionaryEntries}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Entries</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end text-xs pt-2 border-t border-border/30">
              <span className="flex items-center gap-1 text-primary font-medium opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                View Language
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  )
}
