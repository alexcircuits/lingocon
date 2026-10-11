"use client"

import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import type { ParadigmSelectorProps } from "@/components/paradigm-selector-field"

export type { ParadigmSelectorProps }

/** The selector's own loading state: it always starts by fetching the language's paradigms. */
function ParadigmSelectorLoading() {
  const t = useTranslations("studio.paradigms")
  return (
    <div className="space-y-2">
      <Label>{t("paradigm")}</Label>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t("loadingParadigms")}</span>
      </div>
    </div>
  )
}

/**
 * The paradigm picker, code-split: the select menu (with its positioning library) was ~18 kB of
 * the text editor's first-load JS, for a field that shows a loading state until the paradigms
 * arrive anyway. Until its code has loaded it shows that same loading state.
 */
export const ParadigmSelector = dynamic<ParadigmSelectorProps>(
  () => import("@/components/paradigm-selector-field").then((m) => m.ParadigmSelector),
  { loading: ParadigmSelectorLoading }
)
