"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateLanguage } from "@/app/actions/language"
import { InlineEdit } from "@/components/ui/inline-edit"
import { commonRules } from "@/lib/hooks/use-form-validation"

interface InlineLanguageEditProps {
  languageId: string
  field: "name" | "description"
  value: string
  maxLength?: number
}

export function InlineLanguageEdit({
  languageId,
  field,
  value,
  maxLength,
}: InlineLanguageEditProps) {
  const t = useTranslations("inlineLanguageEdit")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSave = async (newValue: string) => {
    startTransition(async () => {
      const result = await updateLanguage({
        id: languageId,
        [field]: newValue,
      })

      if ('error' in result) {
        toast.error(result.error)
        throw new Error(result.error)
      } else {
        toast.success(field === "name" ? t("nameUpdated") : t("descriptionUpdated"))
        router.refresh()
      }
    })
  }

  const validate = (val: string) => {
    if (field === "name") {
      if (!val.trim()) {
        return t("nameRequired")
      }
      if (val.length > 100) {
        return t("nameTooLong")
      }
    }
    if (field === "description" && val.length > 1000) {
      return t("descriptionTooLong")
    }
    return null
  }

  return (
    <InlineEdit
      value={value}
      onSave={handleSave}
      placeholder={field === "name" ? t("namePlaceholder") : t("descriptionPlaceholder")}
      maxLength={maxLength}
      validate={validate}
      disabled={isPending}
    />
  )
}
