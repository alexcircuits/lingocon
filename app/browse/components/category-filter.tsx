"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const CATEGORY_FILTER_VALUES = [
  "all",
  "CONLANG",
  "NATURAL",
  "ENDANGERED",
  "RESTORED",
  "HISTORICAL",
  "FICTIONAL",
  "AUXILIARY",
  "OTHER",
] as const

export type CategoryFilter = (typeof CATEGORY_FILTER_VALUES)[number]

interface CategoryFilterProps {
  currentCategory: CategoryFilter
}

export function CategoryFilter({ currentCategory }: CategoryFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("browse")

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") {
      params.delete("category")
    } else {
      params.set("category", value)
    }
    params.delete("page") // Reset to first page when filter changes
    router.push(`/browse?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t("filterCategoryLabel")}</span>
      <Select value={currentCategory} onValueChange={handleChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("categoryAll")}</SelectItem>
          <SelectItem value="CONLANG">{t("categoryConlang")}</SelectItem>
          <SelectItem value="NATURAL">{t("categoryNatural")}</SelectItem>
          <SelectItem value="ENDANGERED">{t("categoryEndangered")}</SelectItem>
          <SelectItem value="RESTORED">{t("categoryRestored")}</SelectItem>
          <SelectItem value="HISTORICAL">{t("categoryHistorical")}</SelectItem>
          <SelectItem value="FICTIONAL">{t("categoryFictional")}</SelectItem>
          <SelectItem value="AUXILIARY">{t("categoryAuxiliary")}</SelectItem>
          <SelectItem value="OTHER">{t("categoryOther")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
