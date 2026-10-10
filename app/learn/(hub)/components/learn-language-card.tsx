import Link from "next/link"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, GraduationCap, Users, ArrowRight, Globe } from "lucide-react"
import type { LearnableLanguage } from "@/lib/learn-catalog"

function CardStat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="tabular-nums font-medium text-foreground">{value.toLocaleString()}</span>
      {label}
    </span>
  )
}

export function LearnLanguageCard({ language }: { language: LearnableLanguage }) {
  return (
    <Link href={`/learn/${language.slug}`} className="group block">
      <Card className="relative h-full overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary to-accent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="flex items-start gap-3">
          {language.flagUrl ? (
            <Image
              src={language.flagUrl}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-lg object-cover"
              unoptimized={language.flagUrl.startsWith("/uploads/")}
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 font-semibold tracking-tight transition-colors group-hover:text-primary">
              {language.name}
            </h3>
            <p className="text-xs text-muted-foreground">by {language.owner.name || "Anonymous"}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1">
            <GraduationCap className="h-3 w-3" />
            {language.courseCount} course{language.courseCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        {language.description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{language.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <CardStat icon={BookOpen} value={language.lessonCount} label="lessons" />
          <CardStat icon={Users} value={language.learnerCount} label="learners" />
        </div>

        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">
          Start learning
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  )
}
