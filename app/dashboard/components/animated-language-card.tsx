"use client"

import { motion } from "motion/react"
import Link from "next/link"
import { Calendar, FileText, BookOpen, ArrowRight } from "lucide-react"
import { formatDate, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Language } from "@prisma/client"
import { LanguagePlaceholder } from "@/components/language-placeholder"

interface AnimatedLanguageCardProps {
  language: Language & {
    _count: {
      dictionaryEntries: number
      grammarPages: number
    }
  }
  index: number
}

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType
  value: number
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground">
      <Icon className="h-3 w-3 text-primary" />
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
      {label}
    </span>
  )
}

export function AnimatedLanguageCard({ language, index }: AnimatedLanguageCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      <Link href={`/studio/lang/${language.slug}`} className="group block">
        <div className="relative flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card p-4 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 sm:gap-4 sm:p-5">
          <LanguagePlaceholder
            name={language.name}
            flagUrl={language.flagUrl}
            size="md"
            variant="flag"
            className="shrink-0"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold tracking-tight transition-colors group-hover:text-primary sm:text-lg">
                  {language.name}
                </h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="truncate">Updated {formatDate(language.updatedAt)}</span>
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-[10px] font-normal sm:text-xs",
                  language.visibility === "PRIVATE" && "bg-muted text-muted-foreground border-transparent",
                  language.visibility === "UNLISTED" && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                  language.visibility === "PUBLIC" && "bg-primary/10 text-primary border-primary/20",
                )}
              >
                {language.visibility === "PRIVATE"
                  ? "Private"
                  : language.visibility === "UNLISTED"
                    ? "Unlisted"
                    : "Public"}
              </Badge>
            </div>

            {language.description && (
              <p className="mt-2 line-clamp-1 text-sm text-muted-foreground sm:line-clamp-2">
                {language.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <StatPill icon={FileText} value={language._count.dictionaryEntries} label="entries" />
              <StatPill icon={BookOpen} value={language._count.grammarPages} label="pages" />
            </div>
          </div>

          <ArrowRight className="hidden h-5 w-5 shrink-0 self-center text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
        </div>
      </Link>
    </motion.div>
  )
}
