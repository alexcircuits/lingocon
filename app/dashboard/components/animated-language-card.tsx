"use client"

import { motion } from "motion/react"
import Link from "next/link"
import Image from "next/image"
import { Calendar, FileText, BookOpen, ArrowRight, Flag } from "lucide-react"
import { formatDate, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Language } from "@prisma/client"

interface AnimatedLanguageCardProps {
  language: Language & {
    _count: {
      dictionaryEntries: number
      grammarPages: number
    }
  }
  index: number
}

export function AnimatedLanguageCard({ language, index }: AnimatedLanguageCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link href={`/studio/lang/${language.slug}`} className="block group">
        <div className="relative p-5 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {language.flagUrl ? (
                <div className="relative h-10 w-14 overflow-hidden border border-border/40 shrink-0 shadow-sm">
                  <Image
                    src={language.flagUrl}
                    alt={`${language.name} flag`}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    unoptimized={language.flagUrl.startsWith("/uploads/")}
                  />
                </div>
              ) : (
                <div className="h-10 w-14 bg-primary/5 flex items-center justify-center border border-primary/10 group-hover:bg-primary/10 transition-colors shrink-0">
                  <span className="text-lg font-serif text-primary font-bold">
                    {language.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-serif text-lg font-medium group-hover:text-primary transition-colors">
                  {language.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Calendar className="h-3 w-3" />
                  <span>Updated {formatDate(language.updatedAt)}</span>
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-normal",
                language.visibility === "PRIVATE" && "bg-muted text-muted-foreground border-transparent",
                language.visibility === "UNLISTED" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                language.visibility === "PUBLIC" && "bg-primary/10 text-primary border-primary/20"
              )}
            >
              {language.visibility === "PRIVATE" ? "Private" : language.visibility === "UNLISTED" ? "Unlisted" : "Public"}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 pl-[52px]">
            {language.description || "No description provided."}
          </p>

          <div className="flex items-center gap-6 pl-[52px] text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{language._count.dictionaryEntries}</span> entries
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{language._count.grammarPages}</span> pages
            </div>

            <div className="ml-auto flex items-center text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
              Open Studio <ArrowRight className="h-3 w-3 ml-1" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

