"use client"

import { useState, useTransition } from "react"
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
        toast.success(`${field === "name" ? "Name" : "Description"} updated successfully`)
        router.refresh()
      }
    })
  }

  const validate = (val: string) => {
    if (field === "name") {
      if (!val.trim()) {
        return "Name is required"
      }
      if (val.length > 100) {
        return "Name must be 100 characters or less"
      }
    }
    if (field === "description" && val.length > 1000) {
      return "Description must be 1000 characters or less"
    }
    return null
  }

  return (
    <InlineEdit
      value={value}
      onSave={handleSave}
      placeholder={field === "name" ? "Language name" : "Add a description..."}
      maxLength={maxLength}
      validate={validate}
      disabled={isPending}
    />
  )
}

