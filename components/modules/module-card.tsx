import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BadgeCheck, Star, Download } from "lucide-react"
import { ModuleIcon } from "./module-icon"
import { getModuleTypeMeta, averageRating } from "@/lib/modules/types"
import { SURFACE_LABELS, surfacesForType } from "@/lib/modules/surfaces"
import type { ModuleType } from "@prisma/client"

export interface ModuleCardData {
  slug: string
  name: string
  summary: string | null
  type: ModuleType
  icon: string | null
  isOfficial: boolean
  isVerifiedAuthor: boolean
  addCount: number
  ratingSum: number
  ratingCount: number
  author: { name: string | null } | null
}

export function ModuleCard({ module }: { module: ModuleCardData }) {
  const typeMeta = getModuleTypeMeta(module.type)
  const rating = averageRating(module.ratingSum, module.ratingCount)

  return (
    <Link href={`/modules/${module.slug}`} className="group block">
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ModuleIcon name={module.icon ?? typeMeta.icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-medium leading-tight group-hover:text-primary">
                {module.name}
              </h3>
              {module.isOfficial && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Official" />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {module.author?.name ?? "Unknown author"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
            {module.summary || typeMeta.description}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-[11px]">
                {typeMeta.label}
              </Badge>
              {surfacesForType(module.type).slice(0, 2).map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px] font-normal">
                  {SURFACE_LABELS[s].short}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {module.ratingCount > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
                  {rating}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                {module.addCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
